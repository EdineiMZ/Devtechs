# payments-service

Subscriptions, payments, plans, coupons, Mercado Pago webhooks.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `PAYMENTS_SERVICE_PORT` / `PORT` | `3007` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `MP_ACCESS_TOKEN` | â€” | Mercado Pago access token |
| `MP_WEBHOOK_SECRET` | â€” | used to verify incoming webhook signatures |
| `AUTH_INTERNAL_SECRET` | â€” | |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/payments-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/payments-service start
```

Swagger UI is mounted at `http://localhost:3007/payments/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST /plans â€” `payments:plans:manage`
- GET POST /coupons â€” `payments:coupons:create`
- POST /subscriptions â€” start a subscription
- POST /subscriptions/:id/cancel â€” `payments:subscriptions:cancel`
- POST /payments â€” initiate Pix or card payment
- POST /webhooks/mp â€” Mercado Pago webhook (signed)

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/payments/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/payments-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/payments-service lint        # eslint
pnpm --filter @szdevs/payments-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
