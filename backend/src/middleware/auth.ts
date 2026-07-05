import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function signAccessToken(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');

  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(user, secret, { expiresIn });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {

  // Bypass authentication and attach a dummy user for local usage
  req.user = {
    id: 'local-user',
    email: 'admin@local',
    role: 'admin',
  };
  next();
}
