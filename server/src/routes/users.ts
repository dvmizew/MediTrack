import express, { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT user_id, email, full_name, role, is_active, mfa_enabled, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch(
  '/:userId/role',
  authenticate,
  authorize('admin'),
  [body('role').isIn(['admin', 'medic', 'pacient'])],
  async (req, res) => {
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

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

// Toggle user active status (admin only)
router.patch(
  '/:userId/status',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await query(
        'UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING user_id, email, is_active',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  }
);

// Get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
            `SELECT u.user_id, u.email, u.full_name, u.role, u.avatar_url, u.mfa_enabled, u.created_at,
              p.nivel_xp as total_xp, p.current_streak, p.longest_streak, p.current_badge
       FROM users u
       LEFT JOIN patient_profiles p ON u.user_id = p.patient_id
       WHERE u.user_id = $1`,
      [req.user!.userId]
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
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
