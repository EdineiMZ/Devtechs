# auth-service

Authentication, sessions, 2FA, OAuth, audit log surface.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `AUTH_SERVICE_PORT` / `PORT` | `3001` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `JWT_SECRET` | â€” | HS256 signing key for access tokens |
| `JWT_REFRESH_SECRET` | â€” | HS256 signing key for refresh tokens |
| `JWT_2FA_TEMP_SECRET` | â€” | HS256 signing key for the 2FA temp token |
| `AUTH_INTERNAL_SECRET` | â€” | shared secret peer services use on /auth/oauth/login |
| `ENCRYPTION_KEY` | â€” | AES key encrypting per-user TOTP secrets at rest |
| `GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET` | â€” | optional, enables Google OAuth |
| `GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET` | â€” | optional, enables GitHub OAuth |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/auth-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/auth-service start
```

Swagger UI is mounted at `http://localhost:3001/auth/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- POST /auth/register â€” sign up (email + password)
- POST /auth/login â€” sign in; returns tokens or `requires2FA`
- POST /auth/2fa/verify â€” second leg of 2FA login
- POST /auth/refresh â€” exchange refresh token for fresh access token
- POST /auth/logout â€” revoke current session
- GET /auth/me â€” current user (requires verified email)
- POST /auth/email/send-verification â€” request a fresh verification email
- GET /auth/email/verify?token=... â€” confirm an email
- POST /auth/2fa/setup â€” start 2FA (returns QR + secret)
- POST /auth/2fa/enable / disable â€” toggle 2FA
- POST /auth/oauth/login â€” internal endpoint for NextAuth callback
- GET POST PUT DELETE /roles â€” role CRUD (`dev:config:edit`)
- POST /roles/:id/assign/:userId â€” attach role to user
- GET POST DELETE /permissions â€” permission grants
- GET /audit/logs â€” cursor-paginated query (`dev:logs:view`)
- GET /audit/logs/export?format=csv â€” CSV export
- GET /audit/stats â€” top actions / users / modules with errors
- GET /audit/users/:userId/timeline â€” per-user activity
- GET /audit/security-report â€” failed-login IPs, 403 spikes, old sessions (`dev:config:edit`)
- GET /admin/users/:userId/sessions â€” list active sessions
- DELETE /admin/users/:userId/sessions/:sessionId â€” soft-revoke (`auth:users:manage`)

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/auth/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/auth-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/auth-service lint        # eslint
pnpm --filter @szdevs/auth-service test        # jest unit suite
pnpm --filter @szdevs/auth-service test:int    # supertest integration suite (needs Postgres + Redis up)
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
