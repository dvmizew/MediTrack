import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import passport from '../config/passport.js';
import { sanitizeBody } from '../middleware/sanitize.js';
import { generateTotpSecret, verifyTotpCode, generateBackupCodes } from '../utils/mfa.js';
import jwt from 'jsonwebtoken';

const router: Router = express.Router();

// MFA lockout configuration
const MFA_MAX_FAILED = Number(process.env.MFA_MAX_FAILED ?? 5);
const MFA_WINDOW_MINUTES = Number(process.env.MFA_WINDOW_MINUTES ?? 10);
const MFA_REMEMBER_DAYS = Number(process.env.MFA_REMEMBER_DAYS ?? 30);
const MFA_REMEMBER_SECRET = process.env.MFA_REMEMBER_SECRET || process.env.JWT_SECRET || 'devsecret';

async function hasTooManyMfaFailures(userId: number): Promise<boolean> {
  try {
    const windowInterval = `${MFA_WINDOW_MINUTES} minutes`;
    const res = await query(
      `SELECT COUNT(*)::int AS cnt
       FROM mfa_attempts
       WHERE user_id = $1 AND success = false AND attempted_at > NOW() - $2::interval`,
      [userId, windowInterval]
    );
    const cnt = res.rows[0]?.cnt ?? 0;
    return cnt >= MFA_MAX_FAILED;
  } catch (err) {
    // If the table doesn't exist yet or any error occurs, do not block the user
    logger.warn('MFA lockout check failed; proceeding without lockout', { userId, err });
    return false;
  }
}

function issueTrustedDeviceToken(userId: number) {
  return jwt.sign({ userId, typ: 'mfa_trust' }, MFA_REMEMBER_SECRET, { expiresIn: `${MFA_REMEMBER_DAYS}d` });
}

function isTrustedDeviceTokenValid(token: string | undefined, userId: number) {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, MFA_REMEMBER_SECRET) as { userId: number; typ?: string };
    return decoded?.userId === userId && decoded?.typ === 'mfa_trust';
  } catch (err) {
    return false;
  }
}

// Register
router.post(
  '/register',
  sanitizeBody,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().notEmpty(),
    body('role').optional().isIn(['medic', 'pacient']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, fullName, role = 'pacient' } = req.body;

      // Check if user exists
      const existing = await query('SELECT user_id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

            // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING user_id, email, full_name, role`,
        [email, passwordHash, fullName, role]
      );

      const user = result.rows[0];

      // Initialize patient profile if role is pacient
      if (role === 'pacient') {
        await query('INSERT INTO patient_profiles (patient_id) VALUES ($1)', [user.user_id]);
      }

      // Generate token
      const token = generateToken({
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({ 
        token, 
        user: {
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Register error', { error });
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login
router.post(
  '/login',
  sanitizeBody,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty(), body('deviceToken').optional().isString()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, deviceToken } = req.body as { email: string; password: string; deviceToken?: string };

      const result = await query(
        'SELECT user_id, email, password_hash, full_name, role, is_active, mfa_enabled FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.mfa_enabled) {
        const trusted = isTrustedDeviceTokenValid(deviceToken, user.user_id);
        if (!trusted) {
          // Defer full login until MFA verification
          return res.json({ mfaRequired: true, userId: user.user_id, message: 'MFA required' });
        }
      }

      const token = generateToken({ userId: user.user_id, email: user.email, role: user.role });
      logger.info('Login successful', { userId: user.user_id, email: user.email, role: user.role });
      res.json({
        token,
        user: { id: user.user_id, email: user.email, fullName: user.full_name, role: user.role },
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Start MFA setup: generate secret + QR
router.post('/mfa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const email = (req as AuthRequest).user!.email;

    // Basic lockout on setup verification attempts
    if (await hasTooManyMfaFailures(userId)) {
      return res.status(423).json({ error: 'MFA temporarily locked. Try again later.' });
    }

    const existing = await query('SELECT mfa_enabled, mfa_secret FROM users WHERE user_id = $1', [userId]);
    if (existing.rows[0]?.mfa_enabled && existing.rows[0]?.mfa_secret) {
      return res.status(400).json({ error: 'MFA already enabled' });
    }

    const { secret, qrCode } = await generateTotpSecret(email);
    // Frontend will verify and then we persist
    res.json({ secret, qrCode });
  } catch (error) {
    logger.error('MFA setup error', { error });
    res.status(500).json({ error: 'Failed to setup MFA' });
  }
});

// Verify setup: confirm code and persist secret + backup codes
router.post(
  '/mfa/verify-setup',
  authenticate,
  [body('secret').isString().isLength({ min: 20 }), body('totpCode').matches(/^\d{6}$/)],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const userId = (req as AuthRequest).user!.userId;
      const { secret, totpCode } = req.body as { secret: string; totpCode: string };

      if (await hasTooManyMfaFailures(userId)) {
        return res.status(423).json({ error: 'MFA temporarily locked. Try again later.' });
      }

      const ok = verifyTotpCode(secret, totpCode);
      if (!ok) {
        await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, false, $3)', [userId, req.ip, totpCode.length]);
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }

      const backupCodes = generateBackupCodes();
      await query(
        'UPDATE users SET mfa_secret = $1, mfa_backup_codes = $2, mfa_enabled = true, mfa_verified_at = CURRENT_TIMESTAMP WHERE user_id = $3',
        [secret, backupCodes, userId]
      );
      await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, true, $3)', [userId, req.ip, totpCode.length]);

      res.json({ message: 'MFA enabled', backupCodes });
    } catch (error) {
      logger.error('MFA verify setup error', { error });
      res.status(500).json({ error: 'Failed to verify MFA setup' });
    }
  }
);

// MFA login step: verify TOTP or backup code and issue JWT
router.post(
  '/login-mfa',
  sanitizeBody,
  [body('userId').isInt(), body('totpCode').matches(/^\d{6}$|^\w{8}$/), body('rememberDevice').optional().isBoolean()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { userId, totpCode, rememberDevice } = req.body as { userId: number; totpCode: string; rememberDevice?: boolean };

      if (await hasTooManyMfaFailures(userId)) {
        return res.status(423).json({ error: 'Too many failed MFA attempts. Try again later.' });
      }

      const result = await query('SELECT user_id, email, full_name, role, mfa_secret, mfa_backup_codes, is_active FROM users WHERE user_id = $1 AND mfa_enabled = true', [
        userId,
      ]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found or MFA not enabled' });
      const user = result.rows[0];
      if (!user.is_active) return res.status(401).json({ error: 'Account is inactive' });

      const isTotp = totpCode.length === 6;
      const isBackup = totpCode.length === 8;
      let verified = false;

      if (isTotp) verified = verifyTotpCode(user.mfa_secret, totpCode);
      else if (isBackup) verified = (user.mfa_backup_codes || []).includes(totpCode.toUpperCase());

      if (!verified) {
        await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, false, $3)', [userId, req.ip, totpCode.length]);
        return res.status(401).json({ error: 'Invalid code' });
      }

      if (isBackup) {
        const remaining = (user.mfa_backup_codes || []).filter((c: string) => c !== totpCode.toUpperCase());
        await query('UPDATE users SET mfa_backup_codes = $1 WHERE user_id = $2', [remaining, userId]);
      }

      await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, true, $3)', [userId, req.ip, totpCode.length]);

      const token = generateToken({ userId: user.user_id, email: user.email, role: user.role });
      const deviceToken = rememberDevice ? issueTrustedDeviceToken(user.user_id) : undefined;
      res.json({
        token,
        user: { id: user.user_id, email: user.email, fullName: user.full_name, role: user.role },
        deviceToken,
      });
    } catch (error) {
      logger.error('MFA login error', { error });
      res.status(500).json({ error: 'MFA verification failed' });
    }
  }
);

// Disable MFA (requires password)
router.post(
  '/mfa/disable',
  authenticate,
  [body('password').isString().notEmpty()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const userId = (req as AuthRequest).user!.userId;
      const { password } = req.body as { password: string };
      const result = await query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
      const valid = await bcrypt.compare(password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid password' });

      await query('UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_backup_codes = NULL, mfa_verified_at = NULL WHERE user_id = $1', [
        userId,
      ]);
      res.json({ message: 'MFA disabled successfully' });
    } catch (error) {
      logger.error('MFA disable error', { error });
      res.status(500).json({ error: 'Failed to disable MFA' });
    }
  }
);

// Generate new backup codes (verify TOTP)
router.post(
  '/mfa/backup-codes',
  authenticate,
  [body('totpCode').matches(/^\d{6}$/)],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const userId = (req as AuthRequest).user!.userId;
      const { totpCode } = req.body as { totpCode: string };

       if (await hasTooManyMfaFailures(userId)) {
         return res.status(423).json({ error: 'MFA temporarily locked. Try again later.' });
       }
      const result = await query('SELECT mfa_secret FROM users WHERE user_id = $1 AND mfa_enabled = true', [userId]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'MFA not enabled' });
      const ok = verifyTotpCode(result.rows[0].mfa_secret, totpCode);
      if (!ok) {
        await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, false, $3)', [userId, req.ip, totpCode.length]);
        return res.status(401).json({ error: 'Invalid TOTP code' });
      }

      const codes = generateBackupCodes();
      await query('UPDATE users SET mfa_backup_codes = $1 WHERE user_id = $2', [codes, userId]);
      await query('INSERT INTO mfa_attempts (user_id, ip_address, success, code_length) VALUES ($1, $2, true, $3)', [userId, req.ip, totpCode.length]);
      res.json({ message: 'New backup codes generated', backupCodes: codes });
    } catch (error) {
      logger.error('Generate backup codes error', { error });
      res.status(500).json({ error: 'Failed to generate backup codes' });
    }
  }
);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      
      const token = generateToken({
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
    } catch (error) {
      logger.error('Google callback error', { error });
      res.redirect('/login?error=oauth_failed');
    }
  }
);

// Refresh token endpoint
router.post('/refresh-token', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    
    // Fetch fresh user data from database
    const result = await query(
      'SELECT user_id, email, role, is_active FROM users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Generate new token with fresh data
    const newToken = generateToken({
      userId: user.user_id,
      email: user.email,
      role: user.role,
    });

    logger.info('Token refreshed', { userId: user.user_id });

    res.json({
      token: newToken,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Refresh token error', { error });
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

export default router;
