# finance-service

Financial transactions, invoices, accounts, DRE.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `FINANCE_SERVICE_PORT` / `PORT` | `3003` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `AUTH_INTERNAL_SECRET` | â€” | bearer-token validation |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/finance-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/finance-service start
```

Swagger UI is mounted at `http://localhost:3003/finance/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST /transactions â€” list/create (`finance:transactions:view|create`)
- GET POST PATCH /invoices â€” invoice management
- POST /invoices/:id/pay â€” generate payment link
- GET /invoices/:id/pdf â€” stream PDF
- GET /accounts â€” chart of accounts
- GET /dre â€” income statement (`finance:dre:view`)

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/finance/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/finance-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/finance-service lint        # eslint
pnpm --filter @szdevs/finance-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
