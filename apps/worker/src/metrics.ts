import client from 'prom-client';
import http from 'http';
import { env } from './config/env';
import { createLogger } from '@pipeforge/shared';

const logger = createLogger('worker');

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const executionsTotal = new client.Counter({
  name: 'pipeline_executions_total',
  help: 'Total pipeline executions processed, by trigger and outcome',
  labelNames: ['trigger', 'status'],
  registers: [registry],
});

export const executionDuration = new client.Histogram({
  name: 'pipeline_execution_duration_seconds',
  help: 'Pipeline execution duration in seconds, from job pickup to completion/failure',
  labelNames: ['status'],
  buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

// This process has no other HTTP server (unlike apps/api) — a bare
// http.createServer for the one /metrics route avoids pulling in express
// just for this.
export function startMetricsServer(port: number = env.METRICS_PORT) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(port, () => {
    const actualPort = (server.address() as { port: number }).port;
    logger.info({ port: actualPort }, 'Metrics server listening');
  });
  return server;
}
