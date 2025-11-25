import express, { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Get notifications with filtering by status_notif
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status } = req.query;
    
    let queryStr = `SELECT * FROM notifications WHERE user_id = $1`;
    const params: any[] = [userId];
    
    if (status && ['sent', 'snoozed', 'ignored', 'read'].includes(status as string)) {
      queryStr += ` AND status_notif = $2`;
      params.push(status);
    }
    
    queryStr += ` ORDER BY created_at DESC LIMIT 50`;
    
    const result = await query(queryStr, params);

    const mapped = result.rows.map((n: any) => ({
      id: n.notif_id,
      userId: n.user_id,
      type: n.tip,
      status: n.status_notif,
      title: n.title,
      message: n.message,
      referenceId: n.reference_id,
      createdAt: n.created_at,
      readAt: n.read_at,
      isRead: n.status_notif === 'read'
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      'UPDATE notifications SET status_notif = $1 WHERE notif_id = $2 AND user_id = $3 RETURNING *',
      ['read', notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const n = result.rows[0];
    res.json({
      id: n.notif_id,
      userId: n.user_id,
      type: n.tip,
      status: n.status_notif,
      title: n.title,
      message: n.message,
      referenceId: n.reference_id,
      createdAt: n.created_at,
      readAt: n.read_at,
      isRead: n.status_notif === 'read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// Mark notification as snoozed
router.patch('/:notificationId/snooze', authenticate, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      'UPDATE notifications SET status_notif = $1 WHERE notif_id = $2 AND user_id = $3 RETURNING *',
      ['snoozed', notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const n = result.rows[0];
    res.json({
      id: n.notif_id,
      userId: n.user_id,
      type: n.tip,
      status: n.status_notif,
      title: n.title,
      message: n.message,
      referenceId: n.reference_id,
      createdAt: n.created_at,
      readAt: n.read_at,
      isRead: n.status_notif === 'read'
    });
  } catch (error) {
    console.error('Snooze notification error:', error);
    res.status(500).json({ error: 'Failed to snooze notification' });
  }
});

// Mark notification as ignored
router.patch('/:notificationId/ignore', authenticate, async (req: AuthRequest, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.userId;

    const result = await query(
      'UPDATE notifications SET status_notif = $1 WHERE notif_id = $2 AND user_id = $3 RETURNING *',
      ['ignored', notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const n = result.rows[0];
    res.json({
      id: n.notif_id,
      userId: n.user_id,
      type: n.tip,
      status: n.status_notif,
      title: n.title,
      message: n.message,
      referenceId: n.reference_id,
      createdAt: n.created_at,
      readAt: n.read_at,
      isRead: n.status_notif === 'read'
    });
  } catch (error) {
    console.error('Ignore notification error:', error);
    res.status(500).json({ error: 'Failed to ignore notification' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    await query(
      'UPDATE notifications SET status_notif = $1 WHERE user_id = $2 AND status_notif != $1',
      ['read', userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications' });
  }
});

export default router;
