# notification-service

User notification feed + SSE push, Redis-backed pub/sub.

Part of the [DevTechs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `NOTIFICATION_SERVICE_PORT` / `PORT` | `3008` | TCP port to bind. |
| `DATABASE_URL` | — | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | — | Used by rate-limit + cache. Dev-tolerated when offline. |
| `REDIS_URL` | — | pub/sub channel |
| `SMTP_*` | — | email transport (optional) |
| `RESEND_API_KEY` | — | Resend.com transport (optional) |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @devtechs/notification-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @devtechs/notification-service start
```

Swagger UI is mounted at `http://localhost:3008/notification/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET /notifications?unreadOnly=&page= — list
- POST /notifications/:id/read — mark read
- POST /notifications/read-all — mark all read
- DELETE /notifications/:id — dismiss
- GET /notifications/stream — Server-Sent Events feed

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/notification/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @devtechs/notification-service typecheck   # tsc --noEmit
pnpm --filter @devtechs/notification-service lint        # eslint
pnpm --filter @devtechs/notification-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
