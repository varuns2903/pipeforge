import { describe, it, expect, vi } from 'vitest';

// Mocks kafkajs itself (not our code) — tests that kafka-input wires up
// the consumer correctly and parses whatever messages arrive (JSON when
// possible, otherwise wrapped as { value }), without needing a real broker
// for every run of this suite (see kafkaInputLive.test.ts for that).
const connectMock = vi.fn().mockResolvedValue(undefined);
const subscribeMock = vi.fn().mockResolvedValue(undefined);
const disconnectMock = vi.fn().mockResolvedValue(undefined);
let capturedEachMessage: any;
const runMock = vi.fn().mockImplementation(async ({ eachMessage }: any) => {
  capturedEachMessage = eachMessage;
});

vi.mock('kafkajs', () => ({
  Kafka: vi.fn().mockImplementation(function (this: any) {
    this.consumer = () => ({
      connect: connectMock,
      subscribe: subscribeMock,
      run: runMock,
      disconnect: disconnectMock,
    });
  }),
  logLevel: { NOTHING: 0 },
}));

const { PipelineEngine } = await import('../src/engine.js');

async function deliverMessages(messages: string[]) {
  // consumer.run() only registers the callback; deliver messages by
  // invoking it directly, the way kafkajs would per incoming message.
  for (const value of messages) {
    await capturedEachMessage({ message: { value: Buffer.from(value) } });
  }
}

describe('kafka-input', () => {
  const engine = new PipelineEngine();
  const baseConfig = { brokers: 'localhost:9092', topic: 'orders', connectionId: 'test-conn', timeoutMs: 50 };

  it('parses JSON messages into rows', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'kafka-input', label: 'Kafka', config: { ...baseConfig, maxMessages: 2 } } }],
      edges: [],
    };
    const resultPromise = engine.execute(pipeline);
    await new Promise((r) => setTimeout(r, 10));
    await deliverMessages([JSON.stringify({ id: 1, name: 'Alice' }), JSON.stringify({ id: 2, name: 'Bob' })]);

    const result = await resultPromise;
    expect(result['1']).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('wraps a non-JSON message value as { value }', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'kafka-input', label: 'Kafka', config: { ...baseConfig, maxMessages: 1 } } }],
      edges: [],
    };
    const resultPromise = engine.execute(pipeline);
    await new Promise((r) => setTimeout(r, 10));
    await deliverMessages(['not json']);

    const result = await resultPromise;
    expect(result['1']).toEqual([{ value: 'not json' }]);
  });

  it('returns whatever arrived if the topic runs dry before the timeout', async () => {
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'kafka-input', label: 'Kafka', config: { ...baseConfig, maxMessages: 5 } } }],
      edges: [],
    };
    const resultPromise = engine.execute(pipeline);
    await new Promise((r) => setTimeout(r, 10));
    await deliverMessages([JSON.stringify({ id: 1 })]);

    const result = await resultPromise; // times out at 50ms with only 1 of 5 delivered
    expect(result['1']).toEqual([{ id: 1 }]);
  });

  it('rejects a topic with no brokers resolved, bypassing validation via a direct executeNode-shaped config', async () => {
    // The validator (see validator.test.ts) already blocks a missing topic
    // before a pipeline ever reaches the engine; this exercises the
    // engine's own defensive check for the other required field (brokers),
    // which a resolved connection could still omit if misconfigured.
    const pipeline = {
      nodes: [{ id: '1', data: { nodeType: 'kafka-input', label: 'Kafka', config: { topic: 'orders', connectionId: 'test-conn' } } }],
      edges: [],
    };
    await expect(engine.execute(pipeline)).rejects.toThrow(/requires brokers and topic/);
  });
});
