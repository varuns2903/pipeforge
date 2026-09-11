import pino from 'pino';
import { trace } from '@opentelemetry/api';

/**
 * Structured JSON logging (so log lines are queryable in any log aggregator)
 * with human-readable pretty-printing in development.
 *
 * When OpenTelemetry tracing is active (see apps/api/src/tracing.ts —
 * off unless OTEL_EXPORTER_OTLP_ENDPOINT is set) every log line written
 * inside a traced request/job also carries `trace_id`/`span_id`, so a log
 * line can be pasted into the tracing backend's search box (or the reverse:
 * a slow/errored span's trace id grepped out of the logs) to jump straight
 * to the matching trace. Outside any span (startup logs, background code
 * with no active context) this mixin is a no-op — the fields are simply
 * omitted rather than logged as empty/undefined.
 */
function traceContextMixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    mixin: traceContextMixin,
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
  });
}
