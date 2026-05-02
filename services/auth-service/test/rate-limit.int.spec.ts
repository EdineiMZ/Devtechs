import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootTestApp } from './test-app';

/**
 * Rate-limit integration. Two layers in play:
 *   1. `LoginRateLimitGuard` — Redis-backed per-IP failed-login
 *      counter. In dev `COUNT_THRESHOLD = 5000` so this test only
 *      runs when LOGIN_RATE_LIMIT_TIGHTEN=true is set.
 *   2. `CustomThrottlerGuard` — global @nestjs/throttler bucket
 *      (default 100/min). Adjacent specs sharing this process
 *      consume from the same bucket, so we run with --runInBand.
 *
 * If you don't have Redis up, the dev-tolerance branch in
 * `RedisService.run` returns 0/null and the per-IP guard never
 * fires. Skip the spec automatically in that case so the suite
 * stays green on a dev box without Redis.
 */

describe('rate limiting (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const booted = await bootTestApp();
    app = booted.app;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('blocks the IP after 5 failed logins (LoginRateLimitGuard)', async () => {
    if (process.env.LOGIN_RATE_LIMIT_TIGHTEN !== 'true') {
      // eslint-disable-next-line no-console
      console.warn(
        '[rate-limit.int] skipping — set LOGIN_RATE_LIMIT_TIGHTEN=true and rebuild auth-service so the guard threshold drops to 5.',
      );
      return;
    }

    // 5 misses with the same email/IP arm the block.
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'attacker@example.com', password: `Bad-pwd-${i}-2026` });
    }
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'attacker@example.com', password: 'Bad-pwd-final-2026' });

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'LoginBlocked' });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('global throttler returns 429 after >100 reqs/min on the same IP', async () => {
    // The default throttler is in-memory, so this only fires within
    // a single process. Skip when LOGIN_RATE_LIMIT_TIGHTEN was set
    // (the prior test will already have eaten quota).
    if (process.env.LOGIN_RATE_LIMIT_TIGHTEN === 'true') return;

    let saw429 = false;
    for (let i = 0; i < 130; i++) {
      const res = await request(app.getHttpServer()).get('/health');
      if (res.status === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);
  });
});
