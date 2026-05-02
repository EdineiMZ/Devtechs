# projects-service

Project management: kanban, sprints, time tracking.

Part of the [DevTechs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. Tokens issued/validated against [auth-service](../auth-service/README.md).

## Environment

Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.

| Var | Default | Notes |
| --- | --- | --- |
| `PROJECTS_SERVICE_PORT` / `PORT` | `3004` | TCP port to bind. |
| `DATABASE_URL` | — | Postgres connection string. Schema in [packages/database](../../packages/database). |
| `REDIS_URL` | — | Used by rate-limit + cache. Dev-tolerated when offline. |
| `AUTH_INTERNAL_SECRET` | — | |

## Run locally

```bash
# 1. Bring up Postgres + Redis (compose default profile).
docker compose -f infra/docker-compose.yml up -d

# 2. Apply migrations + seed if you haven't already.
pnpm db:migrate && pnpm db:seed

# 3. Start the service in watch mode.
pnpm --filter @devtechs/projects-service dev

# 4. Production-style start (after pnpm build).
pnpm --filter @devtechs/projects-service start
```

Swagger UI is mounted at `http://localhost:3004/projects/docs` (disabled when `NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).

## Endpoints

- GET POST /projects — list/create (`projects:view|create`)
- GET POST PATCH DELETE /projects/:id/tasks — kanban tasks
- POST /projects/:id/sprints — sprint creation (`projects:sprints:manage`)
- POST /tasks/:id/time-entries — log work time

Full reference (request/response shapes, examples) lives at `/docs` (Redoc, unified across all services) or `/projects/docs` (this service's Swagger UI).

## Tests

```bash
pnpm --filter @devtechs/projects-service typecheck   # tsc --noEmit
pnpm --filter @devtechs/projects-service lint        # eslint
pnpm --filter @devtechs/projects-service test        # jest unit suite
```

E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).
