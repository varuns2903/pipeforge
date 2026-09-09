import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { IS_PRODUCTION, AUTH_COOKIE_MAX_AGE_MS } from '../config/env';

// httpOnly so client-side JS (and therefore an XSS payload) can't read the
// token; the JSON body still includes it too, for non-browser API clients
// that use an Authorization header instead of a cookie jar.
const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS
  });
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name } = req.body;
      const result = await authService.register(email, password, name);
      setAuthCookie(res, result.token);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'Email already in use') {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      setAuthCookie(res, result.token);
      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        res.status(401).json({ error: error.message });
        return;
      }
      if (error.message.includes('Account locked')) {
        res.status(423).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('token');
    res.status(204).send();
  }

  async me(req: Request, res: Response) {
    // Requires auth middleware to populate req.user
    res.json({ user: (req as any).user });
  }
}

export const authController = new AuthController();
