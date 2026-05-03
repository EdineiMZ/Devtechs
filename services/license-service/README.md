# license-service

Software licensing: products, client bindings, activation tokens.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `LICENSE_SERVICE_PORT` / `PORT` | `3009` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `LICENSE_SIGNING_KEY` | â€” | Ed25519 private key (PEM) |
| `LICENSE_PUBLIC_KEY` | â€” | Ed25519 public key (PEM) |
| `AUTH_INTERNAL_SECRET` | â€” | |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/license-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/license-service start
```

Swagger UI is mounted at `http://localhost:3009/license/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST /products â€” registered products (`licenses:audit:view`)
- POST /clients/:userId/products â€” bind a product to a client (`licenses:clients:bind`)
- POST /tokens â€” issue activation token (`licenses:tokens:generate`)
- POST /tokens/:id/revoke â€” `licenses:tokens:revoke`
- POST /activations â€” verify a token (called by client SDK)

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/license/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/license-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/license-service lint        # eslint
pnpm --filter @szdevs/license-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
