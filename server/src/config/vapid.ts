import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

export const vapidConfig = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
  subject: process.env.VAPID_SUBJECT || 'mailto:support@meditrack.app'
};

export const validateVapidConfig = () => {
  if (!vapidConfig.publicKey || !vapidConfig.privateKey) {
    logger.warn(
      'VAPID keys not configured. Push notifications will not work. ' +
      'Generate keys with: npm install -g web-push && web-push generate-vapid-keys'
    );
    return false;
  }
  return true;
};
