import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, JWT_EXPIRES_IN, WEB_URL } from '../config/env';
import { sendMail } from './mailer.service';
import { logger } from '../logger';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

// Tokens are emailed as plain text but only their hash is stored, the same
// way passwords are — so a database read alone can't be used to take over
// an account via the verification/reset links.
function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export class AuthService {
  async register(email: string, password: string, name: string) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, name });
    await user.save();

    await this.sendVerificationEmail(user).catch(err => {
      // Registration itself should still succeed even if the mail send fails
      // (e.g. misconfigured SMTP) — the user can request another via resend.
      logger.error({ err }, 'Failed to send verification email');
    });

    return this.generateAuthResponse(user);
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new Error('Account locked due to too many failed login attempts. Try again later.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      throw new Error('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;
      await user.save();
    }

    return this.generateAuthResponse(user);
  }

  async sendVerificationEmail(user: any) {
    const { raw, hash } = generateToken();
    user.emailVerificationTokenHash = hash;
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
    await user.save();

    const link = `${WEB_URL}/verify-email?token=${raw}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your PipeForge email',
      text: `Welcome to PipeForge! Verify your email by visiting:\n\n${link}\n\nThis link expires in 24 hours.`
    });
  }

  async resendVerificationEmail(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.emailVerified) throw new Error('Email already verified');
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationTokenHash: hash,
      emailVerificationExpires: { $gt: new Date() }
    });
    if (!user) throw new Error('Verification link is invalid or has expired');

    user.emailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
  }

  async requestPasswordReset(email: string) {
    const user = await User.findOne({ email });
    // Deliberately don't reveal whether the email exists — the caller
    // always gets the same generic response either way.
    if (!user) return;

    const { raw, hash } = generateToken();
    user.passwordResetTokenHash = hash;
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await user.save();

    const link = `${WEB_URL}/reset-password?token=${raw}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your PipeForge password',
      text: `Reset your password by visiting:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: hash,
      passwordResetExpires: { $gt: new Date() }
    });
    if (!user) throw new Error('Reset link is invalid or has expired');

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    // A password reset is a strong signal the account is legitimately
    // recovered — clear any lockout too so the user isn't still locked out.
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
  }

  private generateAuthResponse(user: any) {
    const token = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as any,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      token,
    };
  }
}

export const authService = new AuthService();
