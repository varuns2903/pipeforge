import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /metrics', () => {
  it('serves Prometheus-format metrics without authentication', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/^# HELP/m);
  });

  it('reflects an HTTP request made against this same app', async () => {
    await request(app).get('/healthz');
    const res = await request(app).get('/metrics');
    expect(res.text).toMatch(/http_requests_total\{method="GET",route="\/healthz",status_code="200"\} \d+/);
  });
});
