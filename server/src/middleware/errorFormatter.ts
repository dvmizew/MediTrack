import type { Request, Response, NextFunction } from 'express';

export function errorFormatter(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = Array.isArray(err.errors) ? err.errors : undefined;
  res.status(status).json({ error: message, errors });
}
