import winston from 'winston';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Human-readable console format for development
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const base = `${timestamp} ${level}: ${message}`;
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const stackString = stack ? `\n${stack}` : '';
  return base + metaString + stackString;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), consoleFormat),
    })
  );
}

export const requestLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};
