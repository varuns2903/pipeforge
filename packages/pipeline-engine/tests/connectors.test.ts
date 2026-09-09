import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { PipelineEngine } from '../src/engine.js';

// Requires a real Postgres reachable at these settings — see
// CONTRIBUTING.md / CI for how it's started (docker run postgres:16-alpine).
// Skips cleanly if unset, so this file doesn't fail everyone else's local run.
const PG_HOST = process.env.TEST_PG_HOST;
const PG_PORT = process.env.TEST_PG_PORT ? parseInt(process.env.TEST_PG_PORT, 10) : 5432;

describe.skipIf(!PG_HOST)('postgres-input (real Postgres)', () => {
  const engine = new PipelineEngine();

  it('runs a query against a real database and returns rows', async () => {
    const pipeline = {
      nodes: [
        {
          id: '1',
          data: {
            nodeType: 'postgres-input',
            label: 'PG',
            config: {
              host: PG_HOST,
              port: PG_PORT,
              database: 'testdb',
              user: 'postgres',
              password: 'testpass',
              query: 'SELECT name, age FROM users ORDER BY age ASC',
              connectionId: 'test-conn',
            }
          }
        }
      ],
      edges: []
    };

    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([
      { name: 'Bob', age: 17 },
      { name: 'Alice', age: 28 },
      { name: 'Charlie', age: 34 },
    ]);
  });

  it('feeds real Postgres rows into a filter node', async () => {
    const pipeline = {
      nodes: [
        {
          id: '1',
          data: {
            nodeType: 'postgres-input',
            label: 'PG',
            config: { host: PG_HOST, port: PG_PORT, database: 'testdb', user: 'postgres', password: 'testpass', query: 'SELECT name, age FROM users', connectionId: 'test-conn' }
          }
        },
        { id: '2', data: { nodeType: 'filter', label: 'Adults', config: { condition: 'row.age >= 18' } } },
      ],
      edges: [{ source: '1', target: '2' }]
    };

    const result = await engine.execute(pipeline);
    expect(result['2']!.length).toBe(2);
  });
});

describe('api-input (real local HTTP server)', () => {
  const engine = new PipelineEngine();
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.headers.authorization !== 'Bearer test-token') {
        res.writeHead(401).end();
        return;
      }
      if (req.url === '/users') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { items: [{ name: 'Alice' }, { name: 'Bob' }] } }));
      } else {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

  it('fetches JSON from a real HTTP endpoint with bearer auth and extracts a nested array', async () => {
    const pipeline = {
      nodes: [
        {
          id: '1',
          data: {
            nodeType: 'api-input',
            label: 'API',
            config: {
              baseUrl,
              path: '/users',
              authType: 'bearer',
              token: 'test-token',
              dataPath: 'data.items',
              connectionId: 'test-conn',
            }
          }
        }
      ],
      edges: []
    };

    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  });

  it('surfaces a clear error on a failed request (e.g. bad auth)', async () => {
    const pipeline = {
      nodes: [
        { id: '1', data: { nodeType: 'api-input', label: 'API', config: { baseUrl, path: '/users', connectionId: 'test-conn' } } }
      ],
      edges: []
    };

    await expect(engine.execute(pipeline)).rejects.toThrow(/API request failed: 401/);
  });
});
