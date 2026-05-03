# rh-service

Human Resources: employees, departments, vacations, schedules, payroll docs.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `RH_SERVICE_PORT` / `PORT` | `3002` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `AUTH_INTERNAL_SECRET` | â€” | used to validate access tokens locally |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/rh-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/rh-service start
```

Swagger UI is mounted at `http://localhost:3002/rh/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST PATCH DELETE /employees â€” CRUD (`rh:employees:manage`)
- GET /employees/:id â€” read (`rh:employees:view`)
- POST /employees/:id/documents â€” upload payroll/contract docs
- GET POST /vacations â€” request and list vacations
- POST /vacations/:id/approve â€” `rh:vacations:approve`
- GET POST /schedules â€” work schedule management (`rh:schedules:manage`)

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/rh/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/rh-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/rh-service lint        # eslint
pnpm --filter @szdevs/rh-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
