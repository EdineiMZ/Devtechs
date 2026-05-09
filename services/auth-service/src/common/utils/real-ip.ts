import type { Request } from 'express';

/**
 * Resolve the real client IP from a request that may have passed through
 * one or more reverse proxies (nginx → web container → auth-service).
 *
 * Priority:
 *   1. `x-real-ip`       — set by nginx, forwarded by the web container
 *   2. `x-forwarded-for` — first non-empty entry (leftmost = original client)
 *   3. `req.ip`          — Express fallback (direct connection IP)
 *
 * Never returns undefined; falls back to 'unknown' if all sources are empty.
 */
export function getRealIp(req: Request): string {
  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.trim()) {
    return xRealIp.trim();
  }

  const xFwdFor = req.headers['x-forwarded-for'];
  if (typeof xFwdFor === 'string') {
    const first = xFwdFor.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.ip ?? 'unknown';
}
