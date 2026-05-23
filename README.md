# SZDevs — Monorepo

Turborepo + pnpm workspaces hospedando todos os apps, serviços e pacotes compartilhados do SZDevs em uma única árvore de código.

```
apps/          → Next.js frontends (web, store)
services/      → NestJS backends (10 microserviços)
packages/      → Bibliotecas compartilhadas (ui, database, storage, types…)
infra/         → docker-compose, nginx gateway, TLS, guia de deploy
docs/          → Documentação técnica e guias de setup
```

---

## Setup rápido

### Opção A — Script automático (recomendado)

**Linux / macOS:**
```bash
chmod +x setup.sh && ./setup.sh
```

**Windows:**
```bat
setup.bat
```

Os scripts verificam pré-requisitos, geram segredos, instalam dependências, sobem o banco via Docker e executam as migrations automaticamente.

### Opção B — Manual

```bash
# 1. Copie e configure o .env
cp .env.example .env
# Edite o .env: POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, NEXTAUTH_SECRET…

# 2. Instale dependências
pnpm install

# 3. Suba a infra (PostgreSQL + Redis)
cd infra && docker compose up -d postgres redis && cd ..

# 4. Execute as migrations
pnpm db:migrate

# 5. Inicie em modo dev
pnpm dev
```

Guia completo: [`docs/SETUP.md`](docs/SETUP.md)

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|------------|--------------|
| Node.js | ≥ 18.17.0 |
| pnpm | ≥ 9.0.0 |
| Docker + Compose v2 | Docker 24+ |

---

## Arquitetura

### Serviços NestJS (ports 3001–3010)

| Serviço | Porta | Responsabilidade |
|---------|-------|-----------------|
| `auth-service` | 3001 | Autenticação, JWT, 2FA, OAuth, sessões, audit log |
| `rh-service` | 3002 | RH: funcionários, departamentos, férias, folha |
| `finance-service` | 3003 | Financeiro: transações, faturas, DRE, contas |
| `projects-service` | 3004 | Projetos: kanban, sprints, tarefas, time tracking |
| `devops-service` | 3005 | Ferramentas de infraestrutura |
| `support-service` | 3006 | Tickets de suporte + chat em tempo real (Socket.IO) |
| `payments-service` | 3007 | Assinaturas, pagamentos, Stripe, Mercado Pago |
| `notification-service` | 3008 | Feed de notificações, SSE, pub/sub Redis, e-mail |
| `license-service` | 3009 | Licenças de software: produtos, ativações, assinatura Ed25519 |
| `developer-service` | 3010 | Console DevOps: operações Docker, filas, logs, VPS (Hostinger) |

### Frontends Next.js

| App | Porta | Superfície |
|-----|-------|-----------|
| `web` | 4000 | Site institucional + portal admin (`/admin/*`) + área do cliente (`/perfil/*`) |
| `store` | 4006 | SaaS público: planos, checkout, conta |

### Pacotes compartilhados

| Pacote | Descrição |
|--------|-----------|
| `@szdevs/database` | Prisma schema + client (compartilhado por todos os serviços) |
| `@szdevs/auth` | Utilitários JWT/sessão |
| `@szdevs/storage` | Adaptador de storage S3-compatível (R2 / MinIO / filesystem) |
| `@szdevs/ui` | Design system: React + Tailwind CSS + shadcn/ui |
| `@szdevs/types` | TypeScript types compartilhados |
| `@szdevs/utils` | Utilitários comuns |
| `@szdevs/config` | Gerenciamento de configuração |
| `@szdevs/license-sdk` | SDK cliente para o sistema de licenças |

### Infraestrutura Docker

| Container | Imagem | Função |
|-----------|--------|--------|
| `SZDevs-postgres` | `postgres:16-alpine` | Banco de dados (compartilhado) |
| `SZDevs-redis` | `redis:7-alpine` | Cache, filas, pub/sub |
| `SZDevs-nginx` | `nginx:alpine` | Reverse proxy + API gateway (prod) |

Rede Docker: `SZDevs` (bridge, subnet `172.16.1.0/24`)

---

## Arquitetura de frontend: um app, duas superfícies

O `apps/web` consolida todos os módulos de negócio em um único app Next.js:

```
apps/web/src/app/
├── page.tsx                    ← landing institucional pública
├── login / register / ...      ← páginas de auth
├── perfil/                     ← portal do cliente (protegido)
│   ├── tickets/
│   └── faturas / notificacoes / configuracoes
└── admin/                      ← portal admin / agente (protegido)
    ├── rh / financeiro / projetos / devops / configuracoes
    ├── suporte/                ← fila de tickets + detalhes
    └── developer/              ← ops de containers + logs + filas
```

Tudo sob `/admin/*` e `/perfil/*` é protegido pelo middleware em `apps/web/src/middleware.ts`:

- Usuário não autenticado → redirect para `/login?callbackUrl=...`
- Usuário com e-mail não verificado → redirect para `/verificar-email`
- Usuário autenticado em `/login` ou `/register` → redirect para `/perfil`

O `apps/store` permanece separado por ser uma superfície SaaS pública (planos/checkout) acessível sem login nas primeiras páginas.

---

## Comandos principais

```bash
# Desenvolvimento
pnpm dev                    # Todos os servidores em paralelo
pnpm dev:web                # Só frontend web
pnpm dev:services           # Só backends NestJS

# Build
pnpm build                  # Build completo via Turborepo
pnpm build:packages         # Só os pacotes compartilhados

# Banco de dados
pnpm db:generate            # Gerar Prisma Client
pnpm db:migrate             # Criar/aplicar migrations
pnpm db:seed                # Popular com dados de exemplo
pnpm db:studio              # Abrir Prisma Studio (GUI)

# Qualidade de código
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript (sem emitir)
pnpm test                   # Jest (unitários)
pnpm test:e2e               # Playwright (E2E)

# Infraestrutura Docker
cd infra
docker compose up -d                     # Só PostgreSQL + Redis (modo dev)
docker compose --profile prod up -d     # Stack completo
docker compose --profile dev-tools up -d # Adminer + Mailhog + MinIO
docker compose --profile migrate run --rm migrate  # Executar migrations
```

Filtrar para um workspace específico:
```bash
pnpm turbo run build --filter=@szdevs/auth-service
pnpm turbo run dev   --filter=@szdevs/web
```

---

## Variáveis de ambiente chave

Copie `.env.example` para `.env` e preencha os valores marcados. Os mais críticos:

| Variável | Descrição | Como gerar |
|----------|-----------|-----------|
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | Senha forte qualquer |
| `JWT_SECRET` | Assinar tokens JWT | `openssl rand -base64 48 \| tr -d '/+=' \| cut -c1-64` |
| `ENCRYPTION_KEY` | Criptografar secrets 2FA (AES) | Exatamente 32 chars |
| `NEXTAUTH_SECRET` | Sessões NextAuth | `openssl rand -base64 36 \| tr -d '/+=' \| cut -c1-48` |
| `AUTH_INTERNAL_SECRET` | Auth entre microserviços | `openssl rand -base64 36 \| ...` |

> ⚠️ `ENCRYPTION_KEY` deve ser **idêntica** em `.env` e `infra/.env`. Chaves diferentes causam falha silenciosa no 2FA.

---

## Dockerfiles

| Arquivo | Uso |
|---------|-----|
| `Dockerfile.service` | Build de qualquer serviço NestJS |
| `Dockerfile.app` | Build dos apps Next.js (standalone output) |
| `Dockerfile.migrate` | Executar migrations Prisma em CI/CD |
| `Dockerfile.finance-service` | Build customizado do finance-service |

```bash
# Build manual de um serviço
docker build \
  --file Dockerfile.service \
  --build-arg PACKAGE_NAME=@szdevs/auth-service \
  --tag szdevs/auth-service:local \
  .

# Build manual de um app
docker build \
  --file Dockerfile.app \
  --build-arg PACKAGE_NAME=@szdevs/web \
  --build-arg APP_NAME=web \
  --tag szdevs/web:local \
  .
```

---

## CI/CD

Três workflows em `.github/workflows/`:

| Workflow | Trigger | Função |
|----------|---------|--------|
| `ci.yml` | Todo PR + push em `main`/`develop` | Lint, typecheck, test, build em paralelo via Turborepo |
| `deploy-staging.yml` | Push em `develop` | Detecta pacotes afetados, build matrix Docker → GHCR, deploy SSH staging, health-check, notifica Slack |
| `deploy-prod.yml` | Push em `main` (aprovação manual) | Igual staging + backup Postgres + semver tag + GitHub Release |

### Segredos necessários no GitHub

| Secret | Escopo | Uso |
|--------|--------|-----|
| `TURBO_TOKEN` | Repositório | Cache remoto Turborepo |
| `TURBO_TEAM` | Repositório | Namespace do cache Turbo |
| `GHCR_TOKEN` | Repositório | Push de imagens Docker para GHCR |
| `STAGING_HOST` | Ambiente `staging` | IP/DNS da VPS de staging |
| `STAGING_SSH_KEY` | Ambiente `staging` | Chave SSH (PEM) do servidor de staging |
| `PROD_HOST` | Ambiente `production` | IP/DNS da VPS de produção |
| `PROD_SSH_KEY` | Ambiente `production` | Chave SSH (PEM) do servidor de produção |
| `SLACK_WEBHOOK` | Repositório | Notificações de deploy |

### Versionamento automático (prod)

O workflow de produção usa conventional commits para calcular o próximo semver:

- `fix:` → patch bump
- `feat:` → minor bump
- `feat!:` ou `BREAKING CHANGE:` → major bump

---

## Documentação

| Arquivo | Conteúdo |
|---------|---------|
| [`docs/SETUP.md`](docs/SETUP.md) | Guia de setup manual detalhado |
| [`infra/DEPLOY.md`](infra/DEPLOY.md) | Deploy em VPS (Hostinger + Cloudflare) |
| [`docs/DESENVOLVIMENTO.md`](docs/DESENVOLVIMENTO.md) | Padrões e fluxo de desenvolvimento |
| [`docs/LICENCIAMENTO.md`](docs/LICENCIAMENTO.md) | Sistema de licenciamento de software |

---

## Notas de segurança importantes

1. **`ENCRYPTION_KEY`** — deve ser idêntica em `.env` e `infra/.env`. Divergência → 2FA silenciosamente quebrado.
2. **Docker socket** — `developer-service` monta `/var/run/docker.sock`. Em produção, restrinja o acesso a essa rota.
3. **Portas internas** — serviços NestJS (3001-3010), PostgreSQL (5432) e Redis (6379) **não devem ser expostos** externamente. Apenas nginx expõe 80/443.
4. **Cloudflare** — configure SSL/TLS no modo **Full (strict)** e ative "Always Use HTTPS".
