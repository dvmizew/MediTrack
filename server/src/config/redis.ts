import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});
