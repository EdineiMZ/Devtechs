import Redis from 'ioredis';

/**
 * Singleton Redis client for Next.js API routes.
 *
 * Cached on `globalThis` so that:
 *   1. Hot-reloading in dev doesn't create a new TCP connection on
 *      every edit (which would exhaust Redis's connection limit
 *      within a few minutes of work).
 *   2. Warm lambda invocations in prod reuse the same connection
 *      instead of paying the handshake cost per request.
 *
 * Environment:
 *   - `REDIS_URL` (preferred) — full connection string, e.g.
 *     `redis://localhost:6379` or `rediss://user:pass@host:6379/0`.
 *   - Fallback: `REDIS_HOST` + `REDIS_PORT`, both optional.
 *
 * Connection errors are logged but never thrown from here — callers
 * should try/catch around actual Redis commands instead, so a Redis
 * outage surfaces as a 5xx on the specific route rather than a
 * boot-time crash.
 */

interface GlobalWithRedis {
  __devtechs_redis__?: Redis;
}

const globalForRedis = globalThis as unknown as GlobalWithRedis;

export function getRedisClient(): Redis {
  if (globalForRedis.__devtechs_redis__) {
    return globalForRedis.__devtechs_redis__;
  }

  const url = process.env.REDIS_URL;
  const client = url
    ? new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false })
    : new Redis({
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        maxRetriesPerRequest: 3,
        lazyConnect: false,
      });

  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[redis] connection error:', err.message);
  });

  globalForRedis.__devtechs_redis__ = client;
  return client;
}
