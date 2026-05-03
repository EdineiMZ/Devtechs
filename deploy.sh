#!/usr/bin/env bash
# =============================================================================
# deploy.sh  —  SZDevs production deploy
#
# Pulls latest code from main, rebuilds changed Docker images, runs Prisma
# migrations, and restarts all production services.
#
# Usage (on the VPS):
#   bash /opt/szdevs/deploy.sh
#
# Force rebuild even with no new commits:
#   FORCE=1 bash /opt/szdevs/deploy.sh
# =============================================================================
set -euo pipefail

REPO_DIR="/opt/szdevs"
INFRA_DIR="/opt/szdevs/infra"
LOG_FILE="/opt/szdevs/deploy.log"

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$ts] $*" | tee -a "$LOG_FILE"
}

section() {
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "  $*"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

fail() {
  log "❌  ERRO: $*"
  exit 1
}

# --------------------------------------------------------------------------- #
# 0. Preflight
# --------------------------------------------------------------------------- #
section "SZDevs deploy iniciado — $(date '+%Y-%m-%d %H:%M:%S')"

[[ -d "$REPO_DIR/.git" ]]              || fail "Repositório não encontrado em $REPO_DIR"
[[ -f "$INFRA_DIR/docker-compose.yml" ]] || fail "docker-compose.yml não encontrado em $INFRA_DIR"

# --------------------------------------------------------------------------- #
# 1. Pull latest code
# --------------------------------------------------------------------------- #
section "[1/4] Atualizando código da branch main"

cd "$REPO_DIR"
git fetch origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [[ "$LOCAL" == "$REMOTE" && "${FORCE:-0}" != "1" ]]; then
  log "Já está atualizado (commit $LOCAL). Nada a fazer."
  log "Use FORCE=1 para forçar rebuild mesmo sem novos commits."
  exit 0
fi

if [[ "$LOCAL" != "$REMOTE" ]]; then
  git pull origin main
  log "Atualizado: ${LOCAL:0:7} → ${REMOTE:0:7}"
else
  log "FORCE=1 ativo — rebuild mesmo sem novos commits."
fi

# --------------------------------------------------------------------------- #
# 2. Build Docker images
# --------------------------------------------------------------------------- #
section "[2/4] Buildando imagens Docker"

cd "$INFRA_DIR"
docker compose --profile prod build \
  || fail "docker compose build falhou — verifique os logs acima"

# --------------------------------------------------------------------------- #
# 3. Prisma migrations
# --------------------------------------------------------------------------- #
section "[3/4] Executando Prisma migrations"

# Garante que o postgres está rodando (é idempotente)
docker compose up -d postgres

log "Aguardando postgres ficar saudável..."
until docker compose exec -T postgres pg_isready -q 2>/dev/null; do
  sleep 2
done
log "Postgres pronto."

docker compose --profile migrate run --rm migrate \
  || fail "prisma migrate deploy falhou"

# --------------------------------------------------------------------------- #
# 4. Subir serviços de produção
# --------------------------------------------------------------------------- #
section "[4/4] Subindo serviços de produção"

docker compose --profile prod up -d --remove-orphans

# --------------------------------------------------------------------------- #
# 5. Health check
# --------------------------------------------------------------------------- #
log "Aguardando 15s para os serviços estabilizarem..."
sleep 15

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  log "✅  Health check: OK (HTTP $HTTP_STATUS)"
else
  log "⚠️   Health check retornou HTTP $HTTP_STATUS"
  log "     Verifique os logs: cd $INFRA_DIR && docker compose --profile prod logs --tail=50"
fi

section "Deploy finalizado — $(date '+%Y-%m-%d %H:%M:%S')"
