import crypto from 'crypto';

/**
 * HMAC-SHA256 signs a webhook payload so the receiver can verify it actually
 * came from this server (and wasn't tampered with) using the same secret
 * shown to them when they configured the webhook.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
