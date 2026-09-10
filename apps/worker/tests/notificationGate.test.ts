import { describe, it, expect } from 'vitest';
import { shouldNotify } from '../src/notificationGate';

describe('shouldNotify', () => {
  it('notifies on failure by default', () => {
    expect(shouldNotify({ notifications: { onFailure: true, onComplete: false } }, 'FAILED')).toBe(true);
  });

  it('does not notify on completion by default', () => {
    expect(shouldNotify({ notifications: { onFailure: true, onComplete: false } }, 'COMPLETED')).toBe(false);
  });

  it('notifies on completion when explicitly enabled', () => {
    expect(shouldNotify({ notifications: { onFailure: true, onComplete: true } }, 'COMPLETED')).toBe(true);
  });

  it('does not notify on failure when explicitly disabled', () => {
    expect(shouldNotify({ notifications: { onFailure: false, onComplete: false } }, 'FAILED')).toBe(false);
  });

  it('is safe against a missing notifications object (older pipeline snapshot)', () => {
    expect(shouldNotify({}, 'FAILED')).toBe(false);
    expect(shouldNotify(null, 'COMPLETED')).toBe(false);
  });
});
