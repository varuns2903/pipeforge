// Loaded first (before any other local module) so that every module which reads
// process.env at import time — e.g. JWT_SECRET in auth.service/auth.middleware —
// sees values from .env rather than picking up defaults before dotenv has run.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in .env — see .env.example.`
    );
  }
  return value;
}

export const JWT_SECRET = required('JWT_SECRET');
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const PORT = process.env.PORT || 3000;
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pipeforge';
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6380', 10);
export const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Kept independent of JWT_EXPIRES_IN (a jsonwebtoken-format string like '7d')
// to avoid pulling in a date-math dependency just for this; if you change
// JWT_EXPIRES_IN, update this too so the cookie doesn't outlive the token
// (harmless if it does — the token itself will just fail verification).
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// SMTP is optional: when unset, the mailer logs emails instead of sending
// them (see services/mailer.service.ts) so verification/reset flows still
// work end-to-end in dev/test without real credentials.
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const MAIL_FROM = process.env.MAIL_FROM || 'PipeForge <no-reply@pipeforge.local>';
