import express, { Router, Request, Response } from 'express';
import webPush from 'web-push';
import { logger } from '../config/logger.js';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { vapidConfig, validateVapidConfig } from '../config/vapid.js';

const router: Router = express.Router();

// Initialize web-push with VAPID keys
if (validateVapidConfig()) {
  webPush.setVapidDetails(
    vapidConfig.subject,
    vapidConfig.publicKey,
    vapidConfig.privateKey
  );
}

/**
 * Send push notification to a user
 */
export async function sendPushToUser(userId: number, payload: any): Promise<void> {
  try {
    const result = await query(
      'SELECT id, endpoint, auth, p256dh FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const sendPromises = result.rows.map(async (row) => {
      try {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            auth: row.auth,
            p256dh: row.p256dh
          }
        };
        await webPush.sendNotification(subscription, payloadString);
      } catch (error: any) {
        logger.error('Send push notification error', { error, userId });
        if (error.statusCode === 410 || error.statusCode === 404) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    logger.error('Send push to user error', { error, userId });
  }
}

// Get VAPID public key
router.get('/vapid-public-key', (req: Request, res: Response) => {
  if (!vapidConfig.publicKey) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: vapidConfig.publicKey });
});

// Subscribe to push notifications
router.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const { endpoint, keys } = subscription;
    const { auth, p256dh } = keys;

    if (!auth || !p256dh) {
      return res.status(400).json({ error: 'Missing subscription keys' });
    }

    // Check if subscription already exists
    const existing = await query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    if (existing.rows.length > 0) {
      // Update existing subscription
      await query(
        `UPDATE push_subscriptions 
         SET auth = $1, p256dh = $2, updated_at = NOW() 
         WHERE user_id = $3 AND endpoint = $4`,
        [auth, p256dh, userId, endpoint]
      );
    } else {
      // Insert new subscription
      await query(
        `INSERT INTO push_subscriptions (user_id, endpoint, auth, p256dh, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [userId, endpoint, auth, p256dh]
      );
    }

    logger.info('Push subscription saved', { userId, endpoint });
    res.json({ success: true });
  } catch (error) {
    logger.error('Subscribe to push error', { error });
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    await query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );

    logger.info('Push subscription removed', { userId, endpoint });
    res.json({ success: true });
  } catch (error) {
    logger.error('Unsubscribe from push error', { error });
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// Get user's subscription status
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;

    const result = await query(
      'SELECT endpoint, created_at FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    res.json({
      subscribed: result.rows.length > 0,
      subscriptions: result.rows.map((row) => ({
        endpoint: row.endpoint,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    logger.error('Get push status error', { error });
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// Send test push notification (admin only)
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user!;

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { targetUserId } = req.body;
    const userId = targetUserId || user.userId;

    // Get user's subscriptions
    const result = await query(
      'SELECT id, endpoint, auth, p256dh FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No push subscriptions found' });
    }

    const payload = JSON.stringify({
      title: '🔔 Notificare test',
      body: 'Sistemul de notificări push funcționează corect!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: '/dashboard',
        timestamp: Date.now()
      }
    });

    // Send to all user's subscriptions
    const sendPromises = result.rows.map(async (row) => {
      try {
        const subscription = {
          endpoint: row.endpoint,
          keys: {
            auth: row.auth,
            p256dh: row.p256dh
          }
        };
        await webPush.sendNotification(subscription, payload);
        return { success: true };
      } catch (error: any) {
        logger.error('Send push notification error', { error, userId });
        // If subscription is invalid (expired/unsubscribed), remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          await query(
            'DELETE FROM push_subscriptions WHERE id = $1',
            [row.id]
          );
        }
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r) => r.success).length;

    logger.info('Test push notification sent', { userId, successCount, total: results.length });

    res.json({
      success: true,
      sent: successCount,
      total: results.length,
      results
    });
  } catch (error) {
    logger.error('Send test push error', { error });
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;
