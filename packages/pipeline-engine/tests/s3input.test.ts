import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'stream';

// Mocks the AWS SDK client itself (not our code) — this tests that
// s3-input builds the right request and correctly parses whatever S3
// hands back (CSV via the streaming parser, JSON via transformToString),
// without needing a real S3 bucket or a MinIO container for CI.
const sendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(function (this: any) { this.send = sendMock; }),
  GetObjectCommand: vi.fn().mockImplementation(function (this: any, input: any) { this.input = input; }),
}));

const { PipelineEngine } = await import('../src/engine.js');

describe('s3-input', () => {
  const engine = new PipelineEngine();
  const baseConfig = {
    bucket: 'my-bucket', region: 'us-east-1', key: 'data.csv',
    accessKeyId: 'AKIA_TEST', secretAccessKey: 'secret_test',
    connectionId: 'test-conn',
  };

  it('parses a CSV object from S3', async () => {
    sendMock.mockResolvedValueOnce({
      Body: Readable.from(['name,age\nAlice,28\nBob,17\n']),
    });

    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 's3-input', label: 'S3', config: baseConfig } }],
      edges: []
    };

    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ name: 'Alice', age: 28 }, { name: 'Bob', age: 17 }]);
  });

  it('parses a JSON object from S3', async () => {
    sendMock.mockResolvedValueOnce({
      Body: { transformToString: async () => JSON.stringify([{ name: 'Charlie' }]) },
    });

    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 's3-input', label: 'S3', config: { ...baseConfig, key: 'data.json', format: 'json' } } }],
      edges: []
    };

    const result = await engine.execute(pipeline);
    expect(result['1']).toEqual([{ name: 'Charlie' }]);
  });

  it('requests the configured bucket and key', async () => {
    sendMock.mockResolvedValueOnce({ Body: Readable.from(['a,b\n1,2\n']) });

    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 's3-input', label: 'S3', config: baseConfig } } ],
      edges: []
    };
    await engine.execute(pipeline);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: { Bucket: 'my-bucket', Key: 'data.csv' } })
    );
  });
});
