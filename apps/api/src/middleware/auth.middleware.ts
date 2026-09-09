import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { JWT_SECRET } from '../config/env';

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Browser clients authenticate via the httpOnly cookie set on login;
    // non-browser API clients (scripts, other services) may instead send
    // an Authorization: Bearer header.
    const authHeader = req.headers.authorization;
    const token = (req as any).cookies?.token || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
