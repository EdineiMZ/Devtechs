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
 * Dev tolerance: in development we use a no-retry strategy so a missing
 * local Redis doesn't log-spam the dev server on every request. The
 * connection is established eagerly so commands don't fail immediately
 * due to an uninitialized stream. Callers still try/catch — see `/api/contato`.
 *
 * Production still uses the hard retry strategy — a missing Redis in
 * prod is an ops alarm, not a soft failure.
 */

interface GlobalWithRedis {
  __devtechs_redis__?: Redis;
  __devtechs_redis_warned__?: boolean;
}

const globalForRedis = globalThis as unknown as GlobalWithRedis;

export const isDevRedis = (): boolean =>
  (process.env.NODE_ENV ?? 'development') !== 'production';

export function getRedisClient(): Redis {
  if (globalForRedis.__devtechs_redis__) {
    return globalForRedis.__devtechs_redis__;
  }

  const dev = isDevRedis();
  const commonOptions = {
    maxRetriesPerRequest: dev ? 1 : 3,
    enableOfflineQueue: false,
    retryStrategy: dev ? () => null : undefined,
  } as const;

  const url = process.env.REDIS_URL;
  const client = url
    ? new Redis(url, commonOptions)
    : new Redis({
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: Number(process.env.REDIS_PORT ?? 6379),
        ...commonOptions,
      });

  client.on('error', (err) => {
    if (dev) {
      // Only log the first offline warning per process, so a dev box
      // without Redis doesn't drown the Next.js terminal.
      if (!globalForRedis.__devtechs_redis_warned__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[redis] unavailable (${err.message}) — running in degraded dev mode.`,
        );
        globalForRedis.__devtechs_redis_warned__ = true;
      }
    } else {
      // eslint-disable-next-line no-console
      console.error('[redis] connection error:', err.message);
    }
  });

  globalForRedis.__devtechs_redis__ = client;
  return client;
}
