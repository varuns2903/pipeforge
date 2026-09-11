// Loaded first (before any other local module) so that every module which reads
// process.env at import time — e.g. JWT_SECRET in auth.service/auth.middleware —
// sees values from .env rather than picking up defaults before dotenv has run.
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { loadEnv } from '@pipeforge/shared';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const schema = z.object({
  // No insecure fallback for either secret — better to refuse to start than
  // silently sign tokens or store credentials under a well-known key.
  JWT_SECRET: z.string().min(16, 'must be at least 16 characters — used to sign auth tokens'),
  CONNECTION_ENCRYPTION_KEY: z.string().min(16, 'must be at least 16 characters — used to encrypt stored connection credentials'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/pipeforge'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6380),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // SMTP is optional: when unset, the mailer logs emails instead of sending
  // them (see services/mailer.service.ts) so verification/reset flows still
  // work end-to-end in dev/test without real credentials.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default('PipeForge <no-reply@pipeforge.local>'),

  // Per-user quotas for the Free plan — see config/plans.ts, which derives
  // the Pro plan's (higher) limits from these. Configurable via env so both
  // can be tuned without a code change as real usage comes in.
  MAX_USER_STORAGE_MB: z.coerce.number().positive().default(500),
  MAX_CONCURRENT_EXECUTIONS_PER_USER: z.coerce.number().int().positive().default(5),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(50),

  // Stripe (test mode) — powers the Pro plan upgrade flow. The secret key
  // and price id have no insecure fallback (refuse to start rather than
  // silently accept checkouts that can't be fulfilled). The webhook secret
  // is the one exception: it doesn't exist until `stripe listen` (local) or
  // a dashboard webhook endpoint (deployed) is set up, which needs this
  // server already running to point at — so it's optional here, and
  // billing.service.ts raises a clear error per-request if a webhook
  // actually arrives before it's configured, rather than blocking startup.
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'must be a Stripe secret key (starts "sk_")'),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
    .refine(v => !v || v.startsWith('whsec_'), 'must be a Stripe webhook signing secret (starts "whsec_")'),
  STRIPE_PRICE_ID_PRO: z.string().startsWith('price_', 'must be a Stripe Price id (starts "price_"), not a Product id'),

  // Observability — both optional, off by default so the app runs with zero
  // extra infra in dev. Set OTEL_EXPORTER_OTLP_ENDPOINT (e.g.
  // http://localhost:4318, an OTLP/HTTP collector like Jaeger or an
  // OTel Collector) to enable distributed tracing; see tracing.ts, which
  // must run before express/mongoose are first imported to instrument them.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('pipeforge-api'),
});

const env = loadEnv(schema);

export const JWT_SECRET = env.JWT_SECRET;
export const CONNECTION_ENCRYPTION_KEY = env.CONNECTION_ENCRYPTION_KEY;
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
export const PORT = env.PORT;
export const MONGODB_URI = env.MONGODB_URI;
export const REDIS_HOST = env.REDIS_HOST;
export const REDIS_PORT = env.REDIS_PORT;
export const WEB_URL = env.WEB_URL;
export const NODE_ENV = env.NODE_ENV;
export const IS_PRODUCTION = env.NODE_ENV === 'production';
// Kept independent of JWT_EXPIRES_IN (a jsonwebtoken-format string like '7d')
// to avoid pulling in a date-math dependency just for this; if you change
// JWT_EXPIRES_IN, update this too so the cookie doesn't outlive the token
// (harmless if it does — the token itself will just fail verification).
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const SMTP_HOST = env.SMTP_HOST;
export const SMTP_PORT = env.SMTP_PORT;
export const SMTP_USER = env.SMTP_USER;
export const SMTP_PASS = env.SMTP_PASS;
export const MAIL_FROM = env.MAIL_FROM;

export const MAX_USER_STORAGE_MB = env.MAX_USER_STORAGE_MB;
export const MAX_CONCURRENT_EXECUTIONS_PER_USER = env.MAX_CONCURRENT_EXECUTIONS_PER_USER;
export const MAX_FILE_SIZE_MB = env.MAX_FILE_SIZE_MB;

export const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
// Normalize an empty string (as set in .env before `stripe listen` has run)
// to undefined, so callers can use a plain truthiness check.
export const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET || undefined;
export const STRIPE_PRICE_ID_PRO = env.STRIPE_PRICE_ID_PRO;

export const OTEL_EXPORTER_OTLP_ENDPOINT = env.OTEL_EXPORTER_OTLP_ENDPOINT;
export const OTEL_SERVICE_NAME = env.OTEL_SERVICE_NAME;
