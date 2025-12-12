import express, { Router, Request, Response } from 'express';
import { sanitizeBody } from '../middleware/sanitize.js';
import { logger } from '../config/logger.js';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { redis } from '../config/redis.js';

const router: Router = express.Router();

// Send message - Uses Message table
router.post('/send', authenticate, sanitizeBody, [
  body('receiverId').isInt(),
  body('continut').notEmpty().trim(),
], async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const senderId = (req as AuthRequest).user!.userId;
      const { receiverId, continut } = req.body;

      // Verify collaboration exists between sender and receiver
      const collaboration = await query(
        `SELECT id FROM doctor_patient 
         WHERE ((doctor_id = $1 AND patient_id = $2) OR (doctor_id = $2 AND patient_id = $1))
         AND status_invitatie = 'accepted'`,
        [senderId, receiverId]
      );

      if (collaboration.rows.length === 0) {
        return res.status(403).json({ error: 'No active collaboration with this user' });
      }

      const result = await query(
        `INSERT INTO messages (sender_id, receiver_id, continut) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [senderId, receiverId, continut]
      );

      // Create notification for receiver
      await query(
        `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
         VALUES ($1, 'chat', 'sent', 'Mesaj nou', 'Ai un mesaj nou', $2)`,
        [receiverId, result.rows[0].message_id]
      );

      const msg = result.rows[0];
      res.status(201).json({
        messageId: msg.message_id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        continut: msg.continut,
        timestampMesaj: msg.timestamp_mesaj,
        isRead: msg.is_read
      });
    } catch (error) {
      logger.error('Send message error', { error });
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Get conversation with specific user
router.get('/conversation/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as AuthRequest).user!.userId;
    const { userId } = req.params;
    const otherUserId = parseInt(userId);

    const result = await query(
      `SELECT m.*, 
              s.full_name as sender_name, s.avatar_url as sender_avatar,
              r.full_name as receiver_name, r.avatar_url as receiver_avatar
       FROM messages m
       JOIN users s ON m.sender_id = s.user_id
       JOIN users r ON m.receiver_id = r.user_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.timestamp_mesaj ASC
       LIMIT 100`,
      [currentUserId, otherUserId]
    );

    // Mark messages as read
    await query(
      'UPDATE messages SET is_read = true WHERE receiver_id = $1 AND sender_id = $2 AND is_read = false',
      [currentUserId, otherUserId]
    );

    res.json(result.rows.map((m: any) => ({
      messageId: m.message_id,
      senderId: m.sender_id,
      receiverId: m.receiver_id,
      continut: m.continut,
      timestampMesaj: m.timestamp_mesaj,
      isRead: m.is_read,
      senderName: m.sender_name,
      senderAvatar: m.sender_avatar,
      receiverName: m.receiver_name,
      receiverAvatar: m.receiver_avatar
    })));
  } catch (error) {
    logger.error('Get conversation error', { error });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get all conversations (list of users chatted with)
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      `SELECT DISTINCT ON (other_user_id)
              other_user_id,
              other_user_name,
              other_user_avatar,
              other_user_role,
              last_message,
              last_message_time,
              unread_count
       FROM (
         SELECT 
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
           CASE WHEN m.sender_id = $1 THEN r.full_name ELSE s.full_name END as other_user_name,
           CASE WHEN m.sender_id = $1 THEN r.avatar_url ELSE s.avatar_url END as other_user_avatar,
           CASE WHEN m.sender_id = $1 THEN r.role ELSE s.role END as other_user_role,
           m.continut as last_message,
           m.timestamp_mesaj as last_message_time,
           COUNT(CASE WHEN m.receiver_id = $1 AND m.is_read = false THEN 1 END) OVER (PARTITION BY 
             CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
           ) as unread_count
         FROM messages m
         JOIN users s ON m.sender_id = s.user_id
         JOIN users r ON m.receiver_id = r.user_id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.timestamp_mesaj DESC
       ) AS conversations
       ORDER BY other_user_id, last_message_time DESC`,
      [userId]
    );

    res.json(result.rows.map((c: any) => ({
      otherUserId: c.other_user_id,
      otherUserName: c.other_user_name,
      otherUserAvatar: c.other_user_avatar,
      otherUserRole: c.other_user_role,
      lastMessage: c.last_message,
      lastMessageTime: c.last_message_time,
      unreadCount: c.unread_count
    })));
  } catch (error) {
    logger.error('Get conversations error', { error });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Mark message as read
router.patch('/:messageId/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      'UPDATE messages SET is_read = true WHERE message_id = $1 AND receiver_id = $2 RETURNING *',
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = result.rows[0];
    res.json({
      messageId: msg.message_id,
      senderId: msg.sender_id,
      receiverId: msg.receiver_id,
      continut: msg.continut,
      timestampMesaj: msg.timestamp_mesaj,
      isRead: msg.is_read
    });
  } catch (error) {
    logger.error('Mark message read error', { error });
    res.status(500).json({ error: 'Failed to mark message' });
  }
});

router.get('/status/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const targetUserId = parseInt(userId);
    
    const online = await redis.get(`user:${targetUserId}:online`);
    const lastSeenStr = await redis.get(`user:${targetUserId}:last_seen`);
    
    // Return online status and last seen timestamp
    // The frontend will handle the formatting of "Active now" vs "last seen X ago"
    const isOnline = online === 'true';
    
    res.json({
      userId: targetUserId,
      online: isOnline,
      lastSeen: isOnline ? null : (lastSeenStr ? parseInt(lastSeenStr) : null)
    });
  } catch (error) {
    logger.error('Get user status error', { error });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

export default router;
