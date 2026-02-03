import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

const router: Router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT user_id, email, full_name, role, is_active, mfa_enabled, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json(result.rows.map((u: any) => ({
      userId: u.user_id,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
      isActive: u.is_active,
      mfaEnabled: u.mfa_enabled,
      createdAt: u.created_at
    })));
  } catch (error) {
    logger.error('Get users error', { error });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch(
  '/:userId/role',
  authenticate,
  authorize('admin'),
  [body('role').isIn(['admin', 'medic', 'pacient'])],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { role } = req.body;

      const result = await query(
        'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 RETURNING user_id, email, full_name, role',
        [role, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      res.json({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      });
    } catch (error) {
      logger.error('Update role error', { error });
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

// Toggle user active status (admin only)
router.patch(
  '/:userId/status',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const result = await query(
        'UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING user_id, email, is_active',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      res.json({
        userId: user.user_id,
        email: user.email,
        isActive: user.is_active
      });
    } catch (error) {
      logger.error('Update status error', { error });
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

// Create new user (admin only)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('fullName').trim().notEmpty(),
    body('role').isIn(['admin', 'medic', 'pacient']),
    body('password').matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).withMessage('Password must be 8+ chars with uppercase, digit, and special char (@$!%*?&)')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, fullName, role, password } = req.body;

      // Check if email already exists
      const existing = await query('SELECT email FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, role, is_active) 
         VALUES ($1, $2, $3, $4, true) 
         RETURNING user_id, email, full_name, role, is_active, created_at`,
        [email, passwordHash, fullName, role]
      );

      if (result.rows.length === 0) {
        return res.status(500).json({ error: 'Failed to create user' });
      }

      // If role is 'pacient', create patient profile
      if (role === 'pacient') {
        const userId = result.rows[0].user_id;
        await query(
          'INSERT INTO patient_profiles (patient_id) VALUES ($1) ON CONFLICT (patient_id) DO NOTHING',
          [userId]
        );
      }

      const user = result.rows[0];
      logger.info('New user created', { email, fullName, role });

      res.status(201).json({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      });
    } catch (error) {
      logger.error('Create user error', { error });
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

// Update user (admin only) - email, name, role, password
router.patch(
  '/:userId',
  authenticate,
  authorize('admin'),
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('fullName').optional().trim().notEmpty(),
    body('role').optional().isIn(['admin', 'medic', 'pacient']),
    body('password').optional().matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).withMessage('Password must be 8+ chars with uppercase, digit, and special char (@$!%*?&)')
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { email, fullName, role, password } = req.body;

      // Check if user exists
      const userExists = await query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if email is taken (by another user)
      if (email) {
        const emailExists = await query(
          'SELECT user_id FROM users WHERE email = $1 AND user_id != $2',
          [email, userId]
        );
        if (emailExists.rows.length > 0) {
          return res.status(409).json({ error: 'Email already exists' });
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (email) {
        updates.push(`email = $${paramCount++}`);
        values.push(email);
      }
      if (fullName) {
        updates.push(`full_name = $${paramCount++}`);
        values.push(fullName);
      }
      if (role) {
        updates.push(`role = $${paramCount++}`);
        values.push(role);
      }
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramCount++}`);
        values.push(passwordHash);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const result = await query(
        `UPDATE users SET ${updates.join(', ')} 
         WHERE user_id = $${paramCount} 
         RETURNING user_id, email, full_name, role, is_active, created_at`,
        values
      );

      const user = result.rows[0];
      logger.info('User updated', { userId, email, fullName, role, passwordChanged: !!password });

      res.json({
        userId: user.user_id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      });
    } catch (error) {
      logger.error('Update user error', { error });
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// Delete user (admin only) - soft delete
router.delete(
  '/:userId',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const adminId = (req as AuthRequest).user!.userId;

      // Prevent deleting yourself
      if (parseInt(userId) === adminId) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
      }

      // Check if user exists
      const userExists = await query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Soft delete: deactivate and anonymize
      const result = await query(
        `UPDATE users 
         SET is_active = false, 
             email = concat('deleted_', user_id, '_', EXTRACT(EPOCH FROM NOW())::text, '@deleted.local'),
             full_name = 'Utilizator Șters',
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 
         RETURNING user_id, email`,
        [userId]
      );

      logger.info('User deleted (soft delete)', { userId, deletedBy: adminId });

      res.json({ 
        message: 'User successfully deleted',
        userId: result.rows[0].user_id
      });
    } catch (error) {
      logger.error('Delete user error', { error });
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    logger.info('GET /me - Fetching profile for user', { userId });
    
    const result = await query(
            `SELECT u.user_id, u.email, u.full_name, u.role, u.mfa_enabled, u.created_at,
              p.nivel_xp as total_xp, p.current_streak, p.longest_streak, p.current_badge
       FROM users u
       LEFT JOIN patient_profiles p ON u.user_id = p.patient_id
       WHERE u.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Map database columns to camelCase for frontend
    const user = result.rows[0];
    logger.info('GET /me - User found', { userId, email: user.email, fullName: user.full_name });
    
    res.json({
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      mfaEnabled: user.mfa_enabled,
      createdAt: user.created_at,
      totalXp: user.total_xp || 0,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      currentBadge: user.current_badge
    });
  } catch (error) {
    logger.error('Get profile error', { error });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user profile by ID (authenticated users can view other profiles)
router.get('/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT u.user_id, u.email, u.full_name, u.role, u.created_at,
              p.nivel_xp as total_xp, p.current_streak, p.longest_streak, p.current_badge
       FROM users u
       LEFT JOIN patient_profiles p ON u.user_id = p.patient_id
       WHERE u.user_id = $1 AND u.is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      createdAt: user.created_at,
      totalXp: user.total_xp || 0,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      currentBadge: user.current_badge
    });
  } catch (error) {
    logger.error('Get user profile error', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
