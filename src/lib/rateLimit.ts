/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Note: state is per-process, so each server instance (or Vercel lambda)
 * tracks its own window. Good enough to stop casual abuse of the agent
 * endpoint; use a shared store (Redis) if accurate global limits are
 * ever required.
 */

export interface RateLimitOptions {
  /** Max requests allowed inside the window */
  limit?: number;
  /** Window size in milliseconds */
  windowMs?: number;
  /** Injectable clock for tests */
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest request leaves the window (0 when allowed) */
  retryAfterSec: number;
}

const MAX_TRACKED_KEYS = 10_000;

const hits = new Map<string, number[]>();

/**
 * Check whether a key (e.g. client IP) is inside its rate budget.
 * Records the hit when allowed.
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const limit = options.limit ?? (Number(process.env.RATE_LIMIT_MAX) || 10);
  const windowMs = options.windowMs ?? (Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60_000);
  const now = (options.now ?? Date.now)();

  // Evict stale keys occasionally so the map cannot grow unbounded
  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [k, ts] of hits) {
      if (ts.every(t => now - t >= windowMs)) hits.delete(k);
    }
  }

  const windowStart = now - windowMs;
  const recent = (hits.get(key) || []).filter(t => t > windowStart);

  if (recent.length >= limit) {
    const retryAfterMs = recent[0] + windowMs - now;
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, retryAfterSec: 0 };
}

/** Test utility: clear all tracked hits. */
export function _resetRateLimits() {
  hits.clear();
}
