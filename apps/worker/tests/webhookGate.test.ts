import { describe, it, expect } from 'vitest';
import { shouldDeliverWebhook } from '../src/webhookGate';

const configured = (overrides: any = {}) => ({
  webhook: { url: 'https://example.com/hook', secretEncrypted: 'abc:def:123', onFailure: true, onComplete: false, ...overrides },
});

describe('shouldDeliverWebhook', () => {
  it('delivers on failure by default', () => {
    expect(shouldDeliverWebhook(configured(), 'FAILED')).toBe(true);
  });

  it('does not deliver on completion by default', () => {
    expect(shouldDeliverWebhook(configured(), 'COMPLETED')).toBe(false);
  });

  it('delivers on completion when explicitly enabled', () => {
    expect(shouldDeliverWebhook(configured({ onComplete: true }), 'COMPLETED')).toBe(true);
  });

  it('does not deliver on failure when explicitly disabled', () => {
    expect(shouldDeliverWebhook(configured({ onFailure: false }), 'FAILED')).toBe(false);
  });

  it('is false when no webhook url is configured', () => {
    expect(shouldDeliverWebhook({ webhook: { onFailure: true } }, 'FAILED')).toBe(false);
  });

  it('is false when a url is set but no secret exists yet', () => {
    expect(shouldDeliverWebhook({ webhook: { url: 'https://example.com', onFailure: true } }, 'FAILED')).toBe(false);
  });

  it('is safe against a missing webhook object (older pipeline snapshot)', () => {
    expect(shouldDeliverWebhook({}, 'FAILED')).toBe(false);
    expect(shouldDeliverWebhook(null, 'COMPLETED')).toBe(false);
  });
});
