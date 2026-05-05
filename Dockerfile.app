# syntax=docker/dockerfile:1.6
#
# =============================================================================
# SZDevs — Next.js app image
#
# Multi-stage build for any workspace under `apps/*`, using Next's
# `output: 'standalone'` mode. The standalone build produces a minimal
# server.js with its own hand-picked node_modules subset (~50MB vs ~800MB
# for a naive copy) — that's what the runtime stage ships.
#
#   docker build \
#     --file Dockerfile.app \
#     --build-arg PACKAGE_NAME=@szdevs/web \
#     --build-arg APP_NAME=web \
#     --tag ghcr.io/org/web:sha \
#     .
#
# IMPORTANT: the target app's `next.config.js` MUST set:
#   output: 'standalone',
#   outputFileTracingRoot: path.join(__dirname, '../../'),
# so that Next's trace walker follows `transpilePackages` out of the app
# folder and into the @szdevs/ui / @szdevs/types workspace packages.
# Without that second flag, standalone output produces a broken tree in
# a monorepo.
# =============================================================================

ARG NODE_VERSION=20-alpine

# ---------------------------------------------------------------------------
# Stage 1: base
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

# ---------------------------------------------------------------------------
# Stage 2: builder
# ---------------------------------------------------------------------------
FROM base AS builder
ARG PACKAGE_NAME
ARG APP_NAME
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_AUTH_SERVICE_URL
ARG NEXT_PUBLIC_RH_SERVICE_URL
ARG NEXT_PUBLIC_FINANCE_URL
ARG NEXT_PUBLIC_PROJECTS_SERVICE_URL
ARG NEXT_PUBLIC_DEVOPS_SERVICE_URL
ARG NEXT_PUBLIC_SUPPORT_URL
ARG NEXT_PUBLIC_NOTIFICATION_URL
ARG NEXT_PUBLIC_LICENSE_URL
ARG NEXT_PUBLIC_DEVELOPER_URL
ARG NEXT_PUBLIC_MP_PUBLIC_KEY
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_RH_SERVICE_URL=$NEXT_PUBLIC_RH_SERVICE_URL
ENV NEXT_PUBLIC_FINANCE_URL=$NEXT_PUBLIC_FINANCE_URL
ENV NEXT_PUBLIC_PROJECTS_SERVICE_URL=$NEXT_PUBLIC_PROJECTS_SERVICE_URL
ENV NEXT_PUBLIC_DEVOPS_SERVICE_URL=$NEXT_PUBLIC_DEVOPS_SERVICE_URL
ENV NEXT_PUBLIC_SUPPORT_URL=$NEXT_PUBLIC_SUPPORT_URL
ENV NEXT_PUBLIC_NOTIFICATION_URL=$NEXT_PUBLIC_NOTIFICATION_URL
ENV NEXT_PUBLIC_LICENSE_URL=$NEXT_PUBLIC_LICENSE_URL
ENV NEXT_PUBLIC_DEVELOPER_URL=$NEXT_PUBLIC_DEVELOPER_URL
ENV NEXT_PUBLIC_MP_PUBLIC_KEY=$NEXT_PUBLIC_MP_PUBLIC_KEY
RUN test -n "${PACKAGE_NAME}" || (echo "PACKAGE_NAME build arg is required" && exit 1)
RUN test -n "${APP_NAME}"     || (echo "APP_NAME build arg is required" && exit 1)

# Next inlines NEXT_PUBLIC_* values at build time, so production-appropriate
# values must be passed as build args on the CI side.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3072"

COPY . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    NODE_ENV=development pnpm install --frozen-lockfile --ignore-scripts

# Prisma client is needed by any app that imports @szdevs/database.
# Harmless on apps that don't touch it.
RUN pnpm --filter @szdevs/database prisma:generate

# Build the target app (and its workspace deps). Standalone output lands
# under apps/<name>/.next/standalone and the static chunks under
# apps/<name>/.next/static.
RUN pnpm --filter "${PACKAGE_NAME}" build
RUN mkdir -p /repo/apps/${APP_NAME}/public

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
ARG APP_NAME
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_AUTH_SERVICE_URL
ARG NEXT_PUBLIC_RH_SERVICE_URL
ARG NEXT_PUBLIC_FINANCE_URL
ARG NEXT_PUBLIC_PROJECTS_SERVICE_URL
ARG NEXT_PUBLIC_DEVOPS_SERVICE_URL
ARG NEXT_PUBLIC_SUPPORT_URL
ARG NEXT_PUBLIC_NOTIFICATION_URL
ARG NEXT_PUBLIC_LICENSE_URL
ARG NEXT_PUBLIC_DEVELOPER_URL
ARG NEXT_PUBLIC_MP_PUBLIC_KEY
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_AUTH_SERVICE_URL=$NEXT_PUBLIC_AUTH_SERVICE_URL
ENV NEXT_PUBLIC_RH_SERVICE_URL=$NEXT_PUBLIC_RH_SERVICE_URL
ENV NEXT_PUBLIC_FINANCE_URL=$NEXT_PUBLIC_FINANCE_URL
ENV NEXT_PUBLIC_PROJECTS_SERVICE_URL=$NEXT_PUBLIC_PROJECTS_SERVICE_URL
ENV NEXT_PUBLIC_DEVOPS_SERVICE_URL=$NEXT_PUBLIC_DEVOPS_SERVICE_URL
ENV NEXT_PUBLIC_SUPPORT_URL=$NEXT_PUBLIC_SUPPORT_URL
ENV NEXT_PUBLIC_NOTIFICATION_URL=$NEXT_PUBLIC_NOTIFICATION_URL
ENV NEXT_PUBLIC_LICENSE_URL=$NEXT_PUBLIC_LICENSE_URL
ENV NEXT_PUBLIC_DEVELOPER_URL=$NEXT_PUBLIC_DEVELOPER_URL
ENV NEXT_PUBLIC_MP_PUBLIC_KEY=$NEXT_PUBLIC_MP_PUBLIC_KEY
ENV APP_NAME=${APP_NAME}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache dumb-init libc6-compat \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Standalone output puts the app's server at `apps/<name>/server.js`
# RELATIVE TO the monorepo root (because outputFileTracingRoot points
# to the workspace root). So we copy the standalone tree AS-IS starting
# from /app, and the static chunks + public folder into the expected
# sibling paths.
COPY --from=builder --chown=node:node /repo/apps/${APP_NAME}/.next/standalone /app
COPY --from=builder --chown=node:node /repo/apps/${APP_NAME}/.next/static      /app/apps/${APP_NAME}/.next/static
COPY --from=builder --chown=node:node /repo/apps/${APP_NAME}/public            /app/apps/${APP_NAME}/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

# CMD uses shell form so ${APP_NAME} expands at container start. dumb-init
# is wrapped around `sh -c` so signals still forward correctly.
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "node apps/${APP_NAME}/server.js"]
