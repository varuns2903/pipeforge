import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { signWebhookPayload } from '../src/webhookSignature';

describe('signWebhookPayload', () => {
  it('produces a hex-encoded HMAC-SHA256 of the payload', () => {
    const payload = JSON.stringify({ event: 'execution.completed' });
    const secret = 'test-secret';

    const signature = signWebhookPayload(payload, secret);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    expect(signature).toBe(expected);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different signature for a different secret', () => {
    const payload = JSON.stringify({ event: 'execution.failed' });
    expect(signWebhookPayload(payload, 'secret-a')).not.toBe(signWebhookPayload(payload, 'secret-b'));
  });

  it('produces a different signature for a different payload', () => {
    const secret = 'test-secret';
    expect(signWebhookPayload('{"a":1}', secret)).not.toBe(signWebhookPayload('{"a":2}', secret));
  });
});
