import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: number;
  email: string;
  role: 'admin' | 'medic' | 'pacient';
}

export const generateToken = (payload: JWTPayload): string => {
  const options: SignOptions = {
    expiresIn: ((process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn']),
  };
  return jwt.sign(payload, JWT_SECRET as Secret, options);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET as Secret) as JWTPayload;
};

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!roles.includes(authReq.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
