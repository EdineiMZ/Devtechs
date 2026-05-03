# SZDevs monorepo

Turborepo + pnpm workspaces hosting every SZDevs app, service, and
shared package under a single source tree.

```
apps/          # Next.js frontends:
               #   - web   (institutional + admin/perfil routes)
               #   - store (public planos / checkout SaaS)
services/      # NestJS backends (auth-service, rh-service, ...)
packages/      # Shared libraries (ui, database, storage, types, ...)
infra/         # docker-compose, nginx gateway, deploy scaffolding
```

---

## Frontend architecture: one app, two surfaces

Earlier iterations of SZDevs shipped one Next.js app per business
module (`apps/rh`, `apps/financeiro`, `apps/projetos`, `apps/devops`,
`apps/suporte`, `apps/developer`) running on ports 3001-3007. That
fan-out had two problems:

1. **No auth gate.** Each module was a public Next.js app with its own
   port, reachable anonymously. Anyone who knew the port could browse
   the (stub) UI without a session.
2. **Cookie / session split.** NextAuth issues cookies per-origin, so
   each port held its own session. Logging into `:3000` did nothing
   on `:3001`. Sharing would require custom middleware on every app
   plus a shared-domain cookie.

The chosen fix (Approach A in the migration prompt) consolidates every
module into the main `apps/web` app:

```
apps/web/src/app/
â”œâ”€â”€ page.tsx                    â† public institutional landing
â”œâ”€â”€ login / register / ...      â† auth pages
â”œâ”€â”€ perfil/                     â† client portal (protected)
â”‚   â”œâ”€â”€ page.tsx
â”‚   â”œâ”€â”€ tickets/...
â”‚   â””â”€â”€ faturas / notificacoes / configuracoes
â””â”€â”€ admin/                      â† admin / agent portal (protected)
    â”œâ”€â”€ page.tsx
    â”œâ”€â”€ rh / financeiro / projetos / devops / configuracoes
    â”œâ”€â”€ suporte/                â† ticket queue + agent detail
    â””â”€â”€ developer/              â† container ops + logs + queues
        â”œâ”€â”€ page.tsx
        â”œâ”€â”€ logs / config / queues
        â””â”€â”€ api/proxy           â† server-side bridge to developer-service
```

Everything under `/admin/*` and `/perfil/*` is gated by
`apps/web/src/middleware.ts`:

- Anonymous user hitting any protected prefix â†’ bounced to
  `/login?callbackUrl=<original-path>`
- Authenticated user with **unverified email** â†’ bounced to
  `/verificar-email`
- Already-authenticated user hitting `/login` or `/register` â†’
  bounced to `/perfil` (or `/verificar-email`)

`apps/store` stays separate because it's a public SaaS surface
(planos / checkout / conta) intentionally reachable without login on
its first pages. Sub-routes (`/conta/*`, `/checkout/*`) carry their
own NextAuth gate.

Permission-level access control happens server-side inside each page
(via `session.user.permissions.includes(...)` + `redirect('/perfil')`)
â€” the middleware only enforces session + email-verified.

---

## Getting started

```bash
pnpm install
pnpm --filter @szdevs/database prisma:generate
pnpm dev                        # turbo-fans out all dev servers
pnpm --filter @szdevs/web dev # or run a single app
```

Requirements: **Node.js â‰¥ 18.17**, **pnpm â‰¥ 9**.

---

## CI/CD

Three GitHub Actions workflows sit under `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | every PR + push to `main`/`develop` | Parallel lint / typecheck / test / build via `turbo run` with the shared remote cache |
| `deploy-staging.yml` | push to `develop` | Detect affected packages with `turbo ... --dry-run=json`, matrix-build Docker images for changed services + apps, push to GHCR, SSH staging VPS, pull + up, health-check, Slack-notify |
| `deploy-prod.yml` | push to `main` | Same pipeline, plus Postgres backup, `environment: production` approval gate, and a semver tag + GitHub Release generated from conventional commits |

All three share a composite action at `.github/actions/setup/` that
installs pnpm, Node, and the lockfile-hashed `node_modules` cache.

### Required secrets

Configure these in **Settings â†’ Secrets and variables â†’ Actions**.
Deploy-specific secrets live under their respective environments
(**Settings â†’ Environments â†’ staging / production**) so production
credentials are never reachable from the staging workflow.

| Secret | Scope | Used by | Purpose |
|---|---|---|---|
| `TURBO_TOKEN` | Repository | All workflows | Bearer token for the Turborepo remote cache. Generate via `pnpm dlx turbo login` or copy from Vercel's Turbo dashboard. |
| `TURBO_TEAM` | Repository | All workflows | Turbo team slug â€” identifies which remote cache namespace to read/write. |
| `GHCR_TOKEN` | Repository | `deploy-*` | Classic PAT with `write:packages` scope. The workflows login to `ghcr.io` as `${{ github.actor }}` with this token to push images. (Alternatively use `GITHUB_TOKEN` if the repo permissions allow it â€” `GHCR_TOKEN` is here so private-package orgs have an override.) |
| `STAGING_HOST` | `staging` environment | `deploy-staging` | DNS name or IP of the staging VPS (e.g. `staging.SZDevs.io`). |
| `STAGING_SSH_KEY` | `staging` environment | `deploy-staging` | PEM-encoded private key for the `deploy` user on the staging VPS. Corresponding public key must be in `/home/deploy/.ssh/authorized_keys`. |
| `PROD_HOST` | `production` environment | `deploy-prod` | DNS name or IP of the production VPS. |
| `PROD_SSH_KEY` | `production` environment | `deploy-prod` | PEM-encoded private key for the `deploy` user on production. Keep this tightly-scoped; rotate on every operator offboarding. |
| `SLACK_WEBHOOK` | Repository | `deploy-*` | Incoming webhook URL for the Slack channel that receives deploy notifications. |

### Production environment protection

`deploy-prod.yml` declares `environment: production` on its `deploy`
job. Configure the protection rules in **Settings â†’ Environments â†’
production**:

1. **Required reviewers** â€” at least one release manager must approve
   before the job starts running.
2. **Wait timer** â€” optional cool-down (e.g. 5 min) between approval
   and execution so the approver can still cancel.
3. **Deployment branches** â€” restrict to `main` only.

Without these, a force-push to `main` would deploy without human
oversight. The workflow file itself doesn't â€” and can't â€” enforce
them; they are a repo-level setting.

### How the deploy workflow decides what to build

Both deploy workflows start with a `detect-changes` job:

```bash
pnpm turbo run build --filter='...[HEAD^1]' --dry-run=json
```

The `...[HEAD^1]` filter resolves to "every package changed in the
latest commit, PLUS every package that depends on one of them". The
JSON output is then jq-split into two arrays:

- `services` â€” any package whose name ends in `-service`
- `apps` â€” any package matching the fixed list of Next.js apps (web,
  rh, financeiro, projetos, devops, suporte, store, developer)

Both arrays feed a `strategy.matrix` on the subsequent `build-services`
and `build-apps` jobs, so each affected package builds on its own
runner in parallel, and a commit that only touches one service only
spins up one builder.

### Semver tagging (prod only)

`deploy-prod.yml` uses
[`mathieudutour/github-tag-action`](https://github.com/mathieudutour/github-tag-action)
to walk the conventional-commit history since the last tag and compute
the next semver version:

- `fix: â€¦` â†’ **patch** bump
- `feat: â€¦` â†’ **minor** bump
- `feat!: â€¦` or `BREAKING CHANGE:` â†’ **major** bump

The tag is computed in a `version` job before builds run (so Docker
images can be tagged with the upcoming version), but only pushed after
the deploy job succeeds. A failed deploy never burns a version number.

---

## Docker images

Two multi-stage Dockerfiles live at the repo root. Both use the repo
root as build context and select the target workspace via build args:

### `Dockerfile.service` â€” NestJS services

```bash
docker build \
  --file Dockerfile.service \
  --build-arg PACKAGE_NAME=@szdevs/auth-service \
  --tag ghcr.io/your-org/auth-service:local \
  .
```

Multi-stage: `base` â†’ `builder` (pnpm install + prisma generate +
`turbo build` + `pnpm --prod deploy /app`) â†’ `runtime` (alpine + `node`
user + `dumb-init`). The `pnpm deploy` step produces a self-contained
prod-only directory â€” workspace `workspace:*` links are resolved into
real files, dev dependencies are stripped, and the final runtime image
copies just that directory.

### `Dockerfile.app` â€” Next.js apps

```bash
docker build \
  --file Dockerfile.app \
  --build-arg PACKAGE_NAME=@szdevs/web \
  --build-arg APP_NAME=web \
  --tag ghcr.io/your-org/web:local \
  .
```

Relies on Next's `output: 'standalone'` mode (set in each app's
`next.config.js`). The standalone bundle includes a hand-picked
`node_modules` subset and a `server.js` entrypoint, so the runtime
image is ~50MB instead of ~800MB.

**Important:** any Next.js app built with `Dockerfile.app` must have
both of these in its `next.config.js`:

```js
output: 'standalone',
outputFileTracingRoot: path.join(__dirname, '../../'),
```

The second flag is what makes standalone output follow
`transpilePackages` out of the app folder and into `packages/*`
workspaces â€” without it, the trace walker stops at the app boundary
and produces a broken image.

---

## Workspace commands

Every command is `pnpm turbo run <task>` at the root, which fans out to
the matching script in every workspace that defines one. Tasks defined
in `turbo.json`:

- `dev` â€” start all dev servers
- `build` â€” production build
- `lint` â€” ESLint
- `typecheck` â€” `tsc --noEmit`
- `test` â€” Jest

Filter to a single workspace with `--filter`:

```bash
pnpm turbo run build --filter=@szdevs/auth-service
pnpm turbo run dev   --filter=@szdevs/web
```
