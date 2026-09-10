import { Router } from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { NODE_ENV } from '../config/env';

export const authRouter = Router();

// Throttle login/register to blunt credential-stuffing and brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => NODE_ENV === 'test',
  message: { error: 'Too many attempts, please try again later.' }
});

const validateRegistration = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('name').notEmpty().withMessage('Name is required')
];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const validateNewPassword = [
  body('token').notEmpty().withMessage('Token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

const validateEmail = [
  body('email').isEmail().withMessage('Valid email is required')
];

// Helper to check validation results
import { validationResult } from 'express-validator';
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

authRouter.post('/register', authLimiter, validateRegistration, validate, authController.register);
authRouter.post('/login', authLimiter, validateLogin, validate, authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);

authRouter.post('/verify-email', authLimiter, authController.verifyEmail);
authRouter.post('/resend-verification', authLimiter, requireAuth, authController.resendVerification);
authRouter.post('/forgot-password', authLimiter, validateEmail, validate, authController.forgotPassword);
authRouter.post('/reset-password', authLimiter, validateNewPassword, validate, authController.resetPassword);
