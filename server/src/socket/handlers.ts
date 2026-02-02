import { Server, Socket } from 'socket.io';
import { verifyToken, JWTPayload } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { redis } from '../config/redis.js';
import { sendPushToUser } from '../routes/push.js';
import { logger } from '../config/logger.js';

interface AuthSocket extends Socket {
  user?: JWTPayload;
}

export const setupSocketHandlers = (io: Server) => {
  // Authentication middleware for socket
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthSocket) => {
    const userId = socket.user!.userId;
    // Socket user connection handler

    socket.join(`user:${userId}`);

    await redis.set(`socket:${userId}`, socket.id, 'EX', 120);
    await redis.set(`user:${userId}:online`, 'true', 'EX', 120);

    io.emit('user-status-change', { userId, online: true });

    // Setup heartbeat to keep online status fresh
    // This runs every 50 seconds to refresh before the 120 second expiration
    const heartbeatInterval = setInterval(async () => {
      try {
        // Check if socket is still connected
        if (socket.connected) {
          await redis.set(`user:${userId}:online`, 'true', 'EX', 120);
          await redis.set(`socket:${userId}`, socket.id, 'EX', 120);
        }
      } catch (error) {
        logger.error('Heartbeat error:', error);
      }
    }, 50000);

    // Join conversation room with another user
    socket.on('join-conversation', async (otherUserId: number) => {
      try {
        // Verify collaboration exists between users - use doctor_patient table
        const result = await query(
          `SELECT id FROM doctor_patient 
           WHERE ((doctor_id = $1 AND patient_id = $2) OR (doctor_id = $2 AND patient_id = $1))
           AND status_invitatie = 'accepted'`,
          [userId, otherUserId]
        );

        if (result.rows.length > 0) {
          // Create a consistent room name (lower ID first)
          const roomName = `conversation:${Math.min(userId, otherUserId)}-${Math.max(userId, otherUserId)}`;
          socket.join(roomName);
          socket.emit('joined-conversation', { otherUserId, room: roomName });
        }
      } catch (error) {
        logger.error('Join conversation error:', error);
      }
    });

    // Handle chat messages - use messages table
    socket.on('send-message', async (data: { receiverId: number; continut: string; tempId?: string }) => {
      try {
        const { receiverId, continut } = data;

        // Verify collaboration exists
        const collaboration = await query(
          `SELECT id FROM doctor_patient 
           WHERE ((doctor_id = $1 AND patient_id = $2) OR (doctor_id = $2 AND patient_id = $1))
           AND status_invitatie = 'accepted'`,
          [userId, receiverId]
        );

        if (collaboration.rows.length === 0) {
          return socket.emit('error', { message: 'Not authorized' });
        }

        // Save message to messages table
        const result = await query(
          'INSERT INTO messages (sender_id, receiver_id, continut) VALUES ($1, $2, $3) RETURNING *',
          [userId, receiverId, continut]
        );

        const savedMessage = result.rows[0];

        // Get sender info
        const userInfo = await query(
          'SELECT full_name, avatar_url FROM users WHERE user_id = $1',
          [userId]
        );

        // Standardize message format for frontend (snake_case to match DB columns)
        const messageData = {
          message_id: savedMessage.message_id,
          sender_id: savedMessage.sender_id,
          receiver_id: savedMessage.receiver_id,
          continut: savedMessage.continut,
          timestamp_mesaj: savedMessage.timestamp_mesaj,
          is_read: savedMessage.is_read,
          sender_name: userInfo.rows[0]?.full_name,
          sender_avatar: userInfo.rows[0]?.avatar_url,
        };

        // Send confirmation to sender with real message_id
        socket.emit('message-sent', {
          tempId: data.tempId,
          message: messageData
        });

        // Emit ONLY to receiver (sender already has optimistic UI update)
        io.to(`user:${receiverId}`).emit('new-message', messageData);

        // Send notification to receiver with status_notif='sent'
        await query(
          `INSERT INTO notifications (user_id, tip, status_notif, title, message, reference_id) 
           VALUES ($1, 'chat', 'sent', 'Mesaj Nou', $2, $3)`,
          [receiverId, `Mesaj nou de la ${userInfo.rows[0].full_name}`, userId]
        );

        io.to(`user:${receiverId}`).emit('notification', {
          tip: 'chat',
          message: 'Mesaj nou primit',
          referenceId: userId
        });

        // Check if receiver is online, if not send push notification
        const isOnline = await redis.get(`user:${receiverId}:online`);
        if (!isOnline) {
          const senderName = userInfo.rows[0]?.full_name || 'Un utilizator';
          await sendPushToUser(receiverId, {
            title: `💬 ${senderName}`,
            body: continut.length > 100 ? continut.substring(0, 100) + '...' : continut,
            icon: userInfo.rows[0]?.avatar_url || '/icon-192.png',
            badge: '/icon-192.png',
            tag: `chat-${userId}`,
            data: {
              url: `/chat/${userId}`,
              type: 'chat',
              senderId: userId,
              timestamp: Date.now()
            }
          });
        }

      } catch (error) {
        logger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (otherUserId: number) => {
      const roomName = `conversation:${Math.min(userId, otherUserId)}-${Math.max(userId, otherUserId)}`;
      socket.to(roomName).emit('user-typing', userId);
    });

    socket.on('stop-typing', (otherUserId: number) => {
      const roomName = `conversation:${Math.min(userId, otherUserId)}-${Math.max(userId, otherUserId)}`;
      socket.to(roomName).emit('user-stop-typing', userId);
    });

    socket.on('disconnect', async () => {
      // Socket disconnection handler
      
      clearInterval(heartbeatInterval);
      
      await redis.del(`socket:${userId}`);
      await redis.del(`user:${userId}:online`);
      await redis.set(`user:${userId}:last_seen`, Date.now().toString());
      
      io.emit('user-status-change', { userId, online: false, lastSeen: Date.now() });
    });
  });
};
