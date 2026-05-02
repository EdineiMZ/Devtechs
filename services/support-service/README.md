# support-service

Tickets + real-time chat (Socket.IO `/support` namespace).

Part of the [DevTechs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `SUPPORT_SERVICE_PORT` / `PORT` | `3006` | TCP port to bind. |
| `DATABASE_URL` | — | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | — | Used by rate-limit + cache. Dev-tolerated when offline. |
| `REDIS_URL` | — | required for Socket.IO Redis adapter |
| `AUTH_INTERNAL_SECRET` | — | |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @devtechs/support-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @devtechs/support-service start
```

Swagger UI is mounted at `http://localhost:3006/support/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST /tickets — list/open (`support:tickets:view`)
- PATCH /tickets/:id — update (`support:tickets:manage`)
- POST /tickets/:id/assign — `support:tickets:assign`
- POST /tickets/:id/messages — REST send-message
- GET /tickets/:id/messages — message history
- GET POST PATCH /kb — knowledge base (`support:kb:edit`)
- Socket.IO `/support` — events `ticket:join`, `message:send`, `message:new`, `typing:*`

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/support/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @devtechs/support-service typecheck   # tsc --noEmit
pnpm --filter @devtechs/support-service lint        # eslint
pnpm --filter @devtechs/support-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
