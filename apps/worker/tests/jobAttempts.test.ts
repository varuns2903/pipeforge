import { describe, it, expect } from 'vitest';
import { isFinalAttempt } from '../src/jobAttempts';

describe('isFinalAttempt', () => {
  it('is not final on the first of 3 attempts', () => {
    expect(isFinalAttempt({ attemptsMade: 0, opts: { attempts: 3 } })).toBe(false);
  });

  it('is not final on the second of 3 attempts', () => {
    expect(isFinalAttempt({ attemptsMade: 1, opts: { attempts: 3 } })).toBe(false);
  });

  it('is final on the third of 3 attempts', () => {
    expect(isFinalAttempt({ attemptsMade: 2, opts: { attempts: 3 } })).toBe(true);
  });

  it('treats a job with no attempts option as single-attempt (always final)', () => {
    expect(isFinalAttempt({ attemptsMade: 0, opts: {} })).toBe(true);
  });
});
