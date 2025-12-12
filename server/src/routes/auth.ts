import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth.js';
import passport from '../config/passport.js';
import { sanitizeBody } from '../middleware/sanitize.js';

const router: Router = express.Router();

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
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const result = await query(
        'SELECT user_id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = generateToken({
        userId: user.user_id,
        email: user.email,
        role: user.role,
      });

      logger.info('Login successful', { userId: user.user_id, email: user.email, role: user.role });

      res.json({
        token,
        user: {
          id: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
        },
      });
    } catch (error) {
      logger.error('Login error', { error });
      res.status(500).json({ error: 'Login failed' });
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
