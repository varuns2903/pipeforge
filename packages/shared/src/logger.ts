import pino from 'pino';

/**
 * Structured JSON logging (so log lines are queryable in any log aggregator)
 * with human-readable pretty-printing in development.
 */
export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    transport: process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
  });
}
