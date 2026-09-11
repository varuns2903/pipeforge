import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import { startMetricsServer, executionsTotal } from '../src/metrics';

function get(port: number, path: string): Promise<{ status: number; body: string; contentType?: string }> {
  return new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port, path }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, body, contentType: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

describe('metrics server', () => {
  const server = startMetricsServer(0); // port 0: OS picks a free port, avoiding conflicts with a real worker process
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('serves Prometheus-format metrics on /metrics', async () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    executionsTotal.inc({ trigger: 'execute-pipeline', status: 'completed' });

    const res = await get(port, '/metrics');
    expect(res.status).toBe(200);
    expect(res.contentType).toMatch(/text\/plain/);
    expect(res.body).toMatch(/pipeline_executions_total\{trigger="execute-pipeline",status="completed"\} \d+/);
  });

  it('404s on any other path', async () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const res = await get(port, '/not-metrics');
    expect(res.status).toBe(404);
  });
});
