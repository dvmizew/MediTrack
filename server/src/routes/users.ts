import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

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

// Get current user profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
            `SELECT u.user_id, u.email, u.full_name, u.role, u.avatar_url, u.mfa_enabled, u.created_at,
              p.nivel_xp as total_xp, p.current_streak, p.longest_streak, p.current_badge
       FROM users u
       LEFT JOIN patient_profiles p ON u.user_id = p.patient_id
       WHERE u.user_id = $1`,
      [(req as AuthRequest).user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Map database columns to camelCase for frontend
    const user = result.rows[0];
    res.json({
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      avatarUrl: user.avatar_url,
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

export default router;
