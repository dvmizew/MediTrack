import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import passport from './config/passport.js';
import { pool } from './config/database.js';
import { redis } from './config/redis.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import collaborationRoutes from './routes/collaborations.js';
import treatmentRoutes from './routes/treatments.js';
import doseRoutes from './routes/doses.js';
import confirmationRoutes from './routes/confirmations.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { startReminderCron } from './cron/reminders.js';
import { startStreakCheckCron } from './cron/streaks.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/collaborations', collaborationRoutes);
app.use('/treatments', treatmentRoutes);
app.use('/doses', doseRoutes);
app.use('/confirmations', confirmationRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io setup
setupSocketHandlers(io);

// Start cron jobs
startReminderCron();
startStreakCheckCron();

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await pool.end();
  await redis.quit();
  process.exit(0);
});
