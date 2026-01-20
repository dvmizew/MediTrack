import express, { Router, Request, Response } from 'express';
import { logger } from '../config/logger.js';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router: Router = express.Router();

// Get notifications with filtering by status_notif
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
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
    logger.error('Get notifications error', { error });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

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
    logger.error('Mark notification read error', { error });
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// Mark notification as snoozed
router.patch('/:notificationId/snooze', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

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
    logger.error('Snooze notification error', { error });
    res.status(500).json({ error: 'Failed to snooze notification' });
  }
});

// Mark notification as ignored
router.patch('/:notificationId/ignore', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

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
    logger.error('Ignore notification error', { error });
    res.status(500).json({ error: 'Failed to ignore notification' });
  }
});

// Mark all as read
router.patch('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    await query(
      'UPDATE notifications SET status_notif = $1 WHERE user_id = $2 AND status_notif != $1',
      ['read', userId]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Mark all read error', { error });
    res.status(500).json({ error: 'Failed to mark all notifications' });
  }
});

// Delete a notification
router.delete('/:notificationId', authenticate, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      'DELETE FROM notifications WHERE notif_id = $1 AND user_id = $2 RETURNING notif_id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, id: result.rows[0].notif_id });
  } catch (error) {
    logger.error('Delete notification error', { error });
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all notifications
router.delete('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    await query(
      'DELETE FROM notifications WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete all notifications error', { error });
    res.status(500).json({ error: 'Failed to delete all notifications' });
  }
});

// Send reminder to patient
router.post('/send-reminder', authenticate, async (req: Request, res: Response) => {
  try {
    const medicId = (req as AuthRequest).user!.userId;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Verify the medic has a collaboration with this patient
    const collabCheck = await query(
      `SELECT * FROM doctor_patient 
       WHERE medic_id = $1 AND pacient_id = $2 AND status = 'active'`,
      [medicId, userId]
    );

    if (collabCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No active collaboration with this patient' });
    }

    // Create reminder notification
    const result = await query(
      `INSERT INTO notifications (user_id, tip, title, message, status_notif, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        userId,
        'reminder',
        'Memento medicament',
        'Medicul tău ți-a trimis un memento pentru medicație. Verifică tratamentele tale active.',
        'sent'
      ]
    );

    const notification = result.rows[0];

    // Send via socket if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('notification', {
        id: notification.notif_id,
        type: 'reminder',
        title: notification.title,
        message: notification.message,
        createdAt: notification.created_at
      });
    }

    res.json({ success: true, notification });
  } catch (error) {
    logger.error('Send reminder error', { error });
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

export default router;
