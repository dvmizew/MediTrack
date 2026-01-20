import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports that need them
dotenv.config();

import { createServer } from 'http';
import { Server } from 'socket.io';
import passport from './config/passport.js';
import { errorFormatter } from './middleware/errorFormatter.js';
import { pool } from './config/database.js';
import { redis } from './config/redis.js';
import { logger, requestLoggerStream } from './config/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import collaborationRoutes from './routes/collaborations.js';
import treatmentRoutes from './routes/treatments.js';
import doseRoutes from './routes/doses.js';
import confirmationRoutes from './routes/confirmations.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { startReminderCron } from './cron/reminders.js';
import { startStreakCheckCron } from './cron/streaks.js';

const app = express();
const httpServer = createServer(app);

// Determine allowed origins - support both HTTP and HTTPS for localhost
const getAllowedOrigins = () => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const origins = [frontendUrl];
  
  // If frontend is http://localhost, also allow https://localhost
  if (frontendUrl.includes('localhost')) {
    if (frontendUrl.startsWith('http://')) {
      origins.push(frontendUrl.replace('http://', 'https://'));
    } else if (frontendUrl.startsWith('https://')) {
      origins.push(frontendUrl.replace('https://', 'http://'));
    }
  }
  
  return origins;
};

const allowedOrigins = getAllowedOrigins();

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Core middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(passport.initialize());

// Disable caching for API responses to avoid stale data in clients
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Request logging
app.use(morgan('combined', { stream: requestLoggerStream }));

// Global rate limiter (generic protection)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300, // shared across all endpoints
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Auth specific stricter limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many auth requests, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/login-mfa', authLimiter);
app.use('/auth/mfa/verify-setup', authLimiter);
app.use('/auth/mfa/setup', authLimiter);
app.use('/auth/mfa/backup-codes', authLimiter);

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/collaborations', collaborationRoutes);
app.use('/treatments', treatmentRoutes);
app.use('/doses', doseRoutes);
app.use('/confirmations', confirmationRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);

// Centralized error formatting
app.use(errorFormatter);
app.use('/admin/reports', reportsRoutes);
app.use('/leaderboard', leaderboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io setup
setupSocketHandlers(io);

// Make io accessible in routes
app.set('io', io);

// Redis pub/sub for real-time notifications
const subscriber = redis.duplicate();
subscriber.subscribe('medication-reminder', (err) => {
  if (err) {
    logger.error('Failed to subscribe to medication-reminder channel', { err });
  } else {
    logger.info('Subscribed to medication-reminder channel');
  }
});

subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    if (channel === 'medication-reminder') {
      // Emit to specific user room
      io.to(`user:${data.userId}`).emit('notification', {
        type: 'reminder',
        ...data,
      });
    }
  } catch (error) {
    logger.error('Redis message handling error', { error });
  }
});

// Start cron jobs
startReminderCron();
startStreakCheckCron();

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, initiating graceful shutdown');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  try {
    await pool.end();
    await redis.quit();
  } catch (err) {
    logger.error('Error during shutdown', { err });
  } finally {
    process.exit(0);
  }
});

export { app }; // optional export for testing
