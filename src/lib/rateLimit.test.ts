import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, _resetRateLimits } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    _resetRateLimits();
  });

  it('allows requests under the limit and blocks beyond it', () => {
    const now = () => 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit('1.2.3.4', { limit: 3, windowMs: 60_000, now }).allowed).toBe(true);
    }
    const blocked = checkRateLimit('1.2.3.4', { limit: 3, windowMs: 60_000, now });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    const now = () => 5_000_000;
    expect(checkRateLimit('a', { limit: 1, windowMs: 60_000, now }).allowed).toBe(true);
    expect(checkRateLimit('b', { limit: 1, windowMs: 60_000, now }).allowed).toBe(true);
    expect(checkRateLimit('a', { limit: 1, windowMs: 60_000, now }).allowed).toBe(false);
  });

  it('releases the budget once the window slides past old hits', () => {
    let t = 10_000_000;
    const now = () => t;
    expect(checkRateLimit('k', { limit: 1, windowMs: 60_000, now }).allowed).toBe(true);
    expect(checkRateLimit('k', { limit: 1, windowMs: 60_000, now }).allowed).toBe(false);
    t += 61_000;
    expect(checkRateLimit('k', { limit: 1, windowMs: 60_000, now }).allowed).toBe(true);
  });
});
