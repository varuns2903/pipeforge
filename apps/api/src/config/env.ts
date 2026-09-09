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
