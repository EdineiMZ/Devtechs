# developer-service

Internal ops console: docker services, queues, logs, config, VPS Hostinger.

Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `DEVELOPER_SERVICE_PORT` / `PORT` | `3010` | TCP port to bind. |
| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |
| `DOCKER_SOCKET_PATH` | â€” | usually /var/run/docker.sock |
| `HOSTINGER_API_TOKEN` | â€” | Bearer token for the Hostinger VPS API |
| `HOSTINGER_API_URL` | â€” | defaults to https://developers.hostinger.com/api/vps/v1 |
| `AUTH_INTERNAL_SECRET` | â€” | |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @szdevs/developer-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @szdevs/developer-service start
```

Swagger UI is mounted at `http://localhost:3010/developer/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET /services â€” list docker compose containers (`dev:services:view`)
- POST /services/:name/start|stop|restart â€” control containers
- GET /logs?service=&since= â€” log stream (`dev:logs:view`)
- GET POST /config â€” feature flags, integrations (`dev:config:edit`)
- GET /queues â€” BullMQ inspection
- GET POST /vps â€” VPS attach/list (`dev:vps:manage`)
- POST /vps/:id/start|stop|restart|snapshots â€” VPS actuators

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/developer/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @szdevs/developer-service typecheck   # tsc --noEmit
pnpm --filter @szdevs/developer-service lint        # eslint
pnpm --filter @szdevs/developer-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
