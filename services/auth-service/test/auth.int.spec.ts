import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { bootTestApp } from './test-app';

/**
 * Integration tests for the auth-service login surface.
 *
 * Pre-reqs (declared in jest.int.config.cjs comment):
 *   - Postgres up with migrations applied.
 *   - Redis up (otherwise the rate-limit guards short-circuit, which
 *     defeats half the assertions below).
 *   - The seed has admin@devtechs.com / Admin@DevTechs2026 active.
 *
 * Style notes:
 *   - We always use `.expect(<status>)` rather than `.toBe(...)` on
 *     the status code, because supertest's failure message includes
 *     the response body when the status is wrong — much faster
 *     to debug than `expected 401 received 200`.
 */

const ADMIN_EMAIL = 'admin@devtechs.com';
const ADMIN_PASSWORD = 'Admin@DevTechs2026';

describe('auth-service /auth (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const booted = await bootTestApp();
    app = booted.app;
  });

  afterAll(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------
  // POST /auth/login
  // -------------------------------------------------------------------

  describe('POST /auth/login', () => {
    it('happy path: returns access + refresh tokens for admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({
        requires2FA: false,
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          email: ADMIN_EMAIL,
          roles: expect.arrayContaining(['admin']),
        },
      });
      // Belt-and-braces: the `permissions` array must include the
      // baseline admin perms or downstream guards will silently 403.
      expect(res.body.user.permissions).toEqual(
        expect.arrayContaining(['dev:logs:view', 'auth:users:manage']),
      );
    });

    it('rejects an unknown email with 401, never 200', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-a-user@devtechs.test', password: 'Whatever@2026' })
        .expect(401);
    });

    it('rejects a malformed email with 400 from class-validator', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: "' OR 1=1 --", password: 'Whatever@2026' })
        .expect(400);
    });

    it('rejects when password is too short (DTO rule)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: '123' })
        .expect(400);
    });

    it('rejects unknown extra fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, sneaky: 'value' })
        .expect(400);
    });
  });

  // -------------------------------------------------------------------
  // GET /auth/me — token-bearing routes
  // -------------------------------------------------------------------

  describe('GET /auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      token = res.body.accessToken;
    });

    it('401 without bearer', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('401 with malformed bearer', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .expect(401);
    });

    it('200 with valid bearer + matches login user', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.email).toBe(ADMIN_EMAIL);
    });
  });

  // -------------------------------------------------------------------
  // Permission gate — admin can hit /audit, no-perm session cannot.
  // -------------------------------------------------------------------

  describe('PermissionGuard on /audit/logs', () => {
    let adminToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      adminToken = res.body.accessToken;
    });

    it('admin (dev:logs:view) → 200', async () => {
      const now = new Date();
      const from = new Date(now.getTime() - 60 * 60 * 1000);
      await request(app.getHttpServer())
        .get(
          `/audit/logs?dateFrom=${encodeURIComponent(from.toISOString())}&dateTo=${encodeURIComponent(now.toISOString())}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('missing dateFrom → 400 (DTO required)', async () => {
      await request(app.getHttpServer())
        .get('/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('no token → 401', async () => {
      await request(app.getHttpServer())
        .get('/audit/logs?dateFrom=2026-01-01T00:00:00Z&dateTo=2026-12-31T00:00:00Z')
        .expect(401);
    });
  });
});
