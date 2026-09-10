import { describe, it, expect, vi } from 'vitest';

vi.mock('@pipeforge/shared', () => ({
  connectionSchema: {},
  decryptSecret: vi.fn((encryptedSecret: string) => encryptedSecret),
}));

vi.mock('mongoose', () => ({
  default: {
    model: vi.fn(() => ({ findById: vi.fn() })),
  },
}));

import { resolveConnections } from '../src/resolveConnections';

const ENCRYPTION_KEY = 'test-key';

describe('resolveConnections', () => {
  it('leaves non-connector nodes untouched', async () => {
    const pipeline = {
      nodes: [{ id: 'n1', data: { nodeType: 'filter', config: { field: 'x' } } }],
    };
    const fetchConnection = vi.fn();

    const result = await resolveConnections(pipeline, ENCRYPTION_KEY, fetchConnection);

    expect(result.nodes[0]).toEqual(pipeline.nodes[0]);
    expect(fetchConnection).not.toHaveBeenCalled();
  });

  it('leaves connector nodes without a connectionId untouched', async () => {
    const pipeline = {
      nodes: [{ id: 'n1', data: { nodeType: 's3-input', config: { key: 'file.csv' } } }],
    };
    const fetchConnection = vi.fn();

    const result = await resolveConnections(pipeline, ENCRYPTION_KEY, fetchConnection);

    expect(result.nodes[0]).toEqual(pipeline.nodes[0]);
    expect(fetchConnection).not.toHaveBeenCalled();
  });

  it('merges connection config, decrypted secret, and node config, with node config winning', async () => {
    const pipeline = {
      nodes: [{
        id: 'n1',
        data: {
          nodeType: 'postgres-input',
          label: 'My Postgres',
          config: { connectionId: 'conn1', query: 'SELECT 1' },
        },
      }],
    };

    const fetchConnection = vi.fn().mockResolvedValue({
      config: { host: 'db.example.com', port: 5432 },
      encryptedSecret: JSON.stringify({ password: 'secret-pw', port: 9999 }),
    });

    const result = await resolveConnections(pipeline, ENCRYPTION_KEY, fetchConnection);

    expect(fetchConnection).toHaveBeenCalledWith('conn1');
    expect(result.nodes[0].data.config).toEqual({
      host: 'db.example.com',
      port: 9999, // decrypted secret overrides connection config
      password: 'secret-pw',
      connectionId: 'conn1', // node's own config wins over both
      query: 'SELECT 1',
    });
  });

  it('throws a clear error when the referenced connection does not exist', async () => {
    const pipeline = {
      nodes: [{
        id: 'n1',
        data: { nodeType: 'api-input', label: 'My API', config: { connectionId: 'missing' } },
      }],
    };
    const fetchConnection = vi.fn().mockResolvedValue(null);

    await expect(resolveConnections(pipeline, ENCRYPTION_KEY, fetchConnection))
      .rejects.toThrow(/My API.*not found|not found.*My API/);
  });

  it('does not mutate the input pipeline', async () => {
    const pipeline = {
      nodes: [{
        id: 'n1',
        data: { nodeType: 's3-input', config: { connectionId: 'conn1', key: 'file.csv' } },
      }],
    };
    const fetchConnection = vi.fn().mockResolvedValue({
      config: { bucket: 'my-bucket' },
      encryptedSecret: JSON.stringify({ accessKeyId: 'AKIA...' }),
    });

    await resolveConnections(pipeline, ENCRYPTION_KEY, fetchConnection);

    expect(pipeline.nodes[0].data.config).toEqual({ connectionId: 'conn1', key: 'file.csv' });
  });
});
