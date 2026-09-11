import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { loadEnv } from '@pipeforge/shared';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const schema = z.object({
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/pipeforge'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6380),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WEB_URL: z.string().url().default('http://localhost:5173'),
  // Must decrypt the same connection credentials apps/api encrypted, so this
  // has to match apps/api's CONNECTION_ENCRYPTION_KEY exactly — no insecure
  // fallback, same reasoning as the api side.
  CONNECTION_ENCRYPTION_KEY: z.string().min(16, 'must be at least 16 characters — used to decrypt stored connection credentials'),

  // SMTP is optional: when unset, the mailer logs emails instead of sending
  // them (see @pipeforge/shared's createMailer) so execution notifications
  // still work end-to-end in dev/test without real credentials.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default('PipeForge <no-reply@pipeforge.local>'),

  // Observability — both optional, off by default. Set
  // OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://localhost:4318, an OTLP/HTTP
  // collector like Jaeger) to enable distributed tracing; see tracing.ts,
  // which must run before mongoose/ioredis are first imported to instrument
  // them. METRICS_PORT serves Prometheus metrics (see metrics.ts) — this
  // process has no other HTTP server, so it gets its own tiny one.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default('pipeforge-worker'),
  METRICS_PORT: z.coerce.number().int().positive().default(9091),
});

export const env = loadEnv(schema);
