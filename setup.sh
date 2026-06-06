#!/usr/bin/env bash
# =============================================================================
# SZDevs — Setup automático (Linux / macOS)
# =============================================================================
# Uso:
#   chmod +x setup.sh && ./setup.sh
#
# O script:
#  1. Verifica pré-requisitos (Node, pnpm, Docker, Docker Compose)
#  2. Cria o arquivo .env com segredos gerados automaticamente
#  3. Instala dependências via pnpm
#  4. Sobe a infraestrutura Docker (PostgreSQL + Redis)
#  5. Executa as migrations do Prisma
#  6. (Opcional) Sobe os servidores de desenvolvimento
# =============================================================================

set -euo pipefail

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERRO]${NC}  $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

# ── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ███████╗███████╗██████╗ ███████╗██╗   ██╗███████╗"
echo "  ██╔════╝╚══███╔╝██╔══██╗██╔════╝██║   ██║██╔════╝"
echo "  ███████╗  ███╔╝ ██║  ██║█████╗  ██║   ██║███████╗"
echo "  ╚════██║ ███╔╝  ██║  ██║██╔══╝  ╚██╗ ██╔╝╚════██║"
echo "  ███████║███████╗██████╔╝███████╗ ╚████╔╝ ███████║"
echo "  ╚══════╝╚══════╝╚═════╝ ╚══════╝  ╚═══╝  ╚══════╝"
echo -e "${NC}"
echo -e "${BOLD}  Setup automático — Monorepo v0.5.0${NC}"
echo    "  ────────────────────────────────────────────────"
echo

# ── Verificar onde estamos ────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Função de geração de segredo ─────────────────────────────────────────────
gen_secret() {
  local len="${1:-64}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 "$((len * 3 / 4 + 1))" | tr -d '/+=\n' | cut -c1-"$len"
  else
    # fallback: /dev/urandom
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$len"
  fi
}

# ── 1. Pré-requisitos ─────────────────────────────────────────────────────────
step "Verificando pré-requisitos"

check_cmd() {
  local cmd="$1" label="$2" hint="$3"
  if command -v "$cmd" &>/dev/null; then
    success "$label encontrado: $(command -v "$cmd")"
  else
    error "$label NÃO encontrado. $hint"
    exit 1
  fi
}

check_cmd node  "Node.js" "Instale via https://nodejs.org (>=18.17)"
check_cmd docker "Docker"  "Instale via https://docs.docker.com/get-docker/"

# Node version check
NODE_VER=$(node -e "process.stdout.write(process.version.replace('v',''))")
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js $NODE_VER é muito antigo. Necessário >=18.17.0"
  exit 1
fi
success "Node.js $NODE_VER ✓"

# Docker Compose v2
if docker compose version &>/dev/null 2>&1; then
  success "Docker Compose v2 ✓"
else
  error "Docker Compose v2 não encontrado. Execute: sudo apt install docker-compose-plugin"
  exit 1
fi

# pnpm — instala se necessário
if ! command -v pnpm &>/dev/null; then
  warn "pnpm não encontrado. Instalando via corepack..."
  corepack enable
  corepack prepare pnpm@9.0.0 --activate
fi
success "pnpm $(pnpm --version) ✓"

# ── 2. Arquivo .env ───────────────────────────────────────────────────────────
step "Configurando arquivo .env"

if [ -f ".env" ]; then
  warn ".env já existe. Pulando criação (para recriar: rm .env && ./setup.sh)"
else
  log "Copiando .env.example → .env"
  cp .env.example .env

  log "Gerando segredos aleatórios..."

  JWT_SECRET=$(gen_secret 64)
  JWT_REFRESH_SECRET=$(gen_secret 64)
  NEXTAUTH_SECRET=$(gen_secret 48)
  ENCRYPTION_KEY=$(gen_secret 32)
  AUTH_INTERNAL_SECRET=$(gen_secret 48)

  # Substitui os placeholders no .env
  sed -i "s|change-me-to-a-long-random-string|${JWT_SECRET}|g"               .env
  sed -i "s|change-me-to-another-long-random-string|${JWT_REFRESH_SECRET}|g" .env
  sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEXTAUTH_SECRET}|g"         .env
  sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENCRYPTION_KEY}|g"           .env
  sed -i "s|AUTH_INTERNAL_SECRET=.*|AUTH_INTERNAL_SECRET=${AUTH_INTERNAL_SECRET}|g" .env

  success ".env criado com segredos gerados automaticamente"
  echo
  echo -e "  ${YELLOW}Segredos gerados (guarde em local seguro):${NC}"
  echo    "  ┌──────────────────────────────────────────────────────────────"
  echo    "  │  JWT_SECRET          = ${JWT_SECRET:0:32}..."
  echo    "  │  NEXTAUTH_SECRET     = ${NEXTAUTH_SECRET:0:32}..."
  echo    "  │  ENCRYPTION_KEY      = ${ENCRYPTION_KEY}"
  echo    "  │  AUTH_INTERNAL_SECRET= ${AUTH_INTERNAL_SECRET:0:32}..."
  echo    "  └──────────────────────────────────────────────────────────────"
fi

# ── 3. Instalar dependências ──────────────────────────────────────────────────
step "Instalando dependências (pnpm install)"
pnpm install
success "Dependências instaladas"

# ── 4. Gerar cliente Prisma ───────────────────────────────────────────────────
step "Gerando Prisma Client"
pnpm db:generate
success "Prisma Client gerado"

# ── 5. Subir infraestrutura Docker ────────────────────────────────────────────
step "Subindo PostgreSQL + Redis via Docker"
cd infra
docker compose up -d postgres redis
log "Aguardando PostgreSQL ficar saudável..."
timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -q; do sleep 2; done' \
  && success "PostgreSQL pronto" \
  || { error "PostgreSQL não ficou healthy em 60s"; exit 1; }
cd ..

# ── 6. Migrations ─────────────────────────────────────────────────────────────
step "Executando migrations do banco de dados"
pnpm db:migrate
success "Migrations aplicadas"

# ── 7. Perguntar sobre seed ───────────────────────────────────────────────────
echo
read -r -p "$(echo -e "${YELLOW}Deseja popular o banco com dados de exemplo (seed)? [s/N]${NC} ")" SEED_ANSWER
if [[ "$SEED_ANSWER" =~ ^[Ss]$ ]]; then
  step "Executando seed"
  pnpm db:seed
  success "Banco populado com dados de exemplo"
fi

# ── 8. Resultado final ────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✅  Setup concluído com sucesso!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${NC}"
echo
echo -e "  ${BOLD}Próximos passos:${NC}"
echo
echo    "  1. Configure as variáveis externas no .env:"
echo    "     - SMTP_HOST / SMTP_USER / SMTP_PASS   (e-mails)"
echo    "     - GITHUB_CLIENT_ID / GOOGLE_CLIENT_ID (OAuth)"
echo    "     - STRIPE_SECRET_KEY                   (pagamentos)"
echo    "     - STORAGE_ENDPOINT / ACCESS_KEY        (storage)"
echo
echo    "  2. Para iniciar em modo desenvolvimento:"
echo -e "     ${CYAN}pnpm dev${NC}              # todos os serviços"
echo -e "     ${CYAN}pnpm dev:web${NC}          # só o frontend web"
echo -e "     ${CYAN}pnpm dev:services${NC}     # só os backends"
echo
echo    "  3. Para rodar o stack completo em Docker (modo produção):"
echo -e "     ${CYAN}cd infra && docker compose --profile prod up -d${NC}"
echo
echo    "  URLs locais:"
echo    "  ┌─────────────────────────────────────────────────"
echo    "  │  Web (admin)   → http://localhost:4000"
echo    "  │  Store         → http://localhost:4006"
echo    "  │  Auth API      → http://localhost:3001"
echo    "  │  Adminer (DB)  → http://localhost:8080  (se --profile dev-tools)"
echo    "  └─────────────────────────────────────────────────"
echo
echo    "  Documentação:"
echo    "  ┌─────────────────────────────────────────────────"
echo    "  │  Setup manual  → docs/SETUP.md"
echo    "  │  Deploy VPS    → infra/DEPLOY.md"
echo    "  │  Arquitetura   → README.md"
echo    "  └─────────────────────────────────────────────────"
echo
