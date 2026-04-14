import { getRedisClient } from './redis';

export interface RateLimitResult {
  /** Whether the current request is allowed through. */
  allowed: boolean;
  /** Seconds until the caller can retry, 0 when `allowed` is true. */
  retryAfterSeconds: number;
  /** Remaining quota in the current window. */
  remaining: number;
  /** Current count after this attempt was registered. */
  count: number;
}

/**
 * Simple Redis-backed sliding-window rate limiter.
 *
 * The window is a single counter with a TTL: `INCR` on first hit
 * sets the count to 1, then we attach the TTL via `EXPIRE`. Subsequent
 * hits within the window increment but don't reset the TTL, so the
 * window effectively expires at the configured duration after the
 * FIRST request and callers get a fresh quota afterwards.
 *
 * We deliberately do NOT distinguish "throttled on this request" from
 * "throttled on every request after this one" — any request that
 * lands after the limit is treated as over-quota, which is both
 * simpler and slightly friendlier to legitimate users who briefly
 * burst above the limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  const count = await redis.incr(key);
  // First hit in the window → attach the TTL. Every later hit leaves
  // the existing TTL alone so the window doesn't slide forward.
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  if (count > limit) {
    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, ttl),
      remaining: 0,
      count,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: limit - count,
    count,
  };
}
