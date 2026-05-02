# DevTechs — Guia de Desenvolvimento

Este guia concentra os comandos necessários para subir a plataforma
DevTechs em ambiente de **desenvolvimento** e **produção**. A stack
é um monorepo pnpm + Turborepo com vários apps Next.js, diversos
microserviços NestJS e pacotes compartilhados.

---

## 📋 Pré-requisitos

| Ferramenta | Versão mínima |
|------------|---------------|
| Node.js    | 18.17.0       |
| pnpm       | 9.0.0         |
| PostgreSQL | 14+           |
| Redis      | 6+            |

Clone o repositório e copie o `.env.example` (se existir) para `.env`
na raiz. A configuração atual já inclui URLs locais para Postgres e
Redis na raiz do monorepo — cada serviço também aceita `.env.local`.

---

## 🚀 Bootstrap (primeira execução)

Um único comando resolve o setup inicial completo:

```bash
pnpm bootstrap
```

Isso executa, em ordem:

1. `pnpm install` — resolve e instala todas as dependências do workspace.
2. `pnpm build:packages` — compila os pacotes compartilhados (`@devtechs/database`, `@devtechs/storage`, etc.).
3. `pnpm db:generate` — regenera o Prisma Client.
4. `pnpm db:migrate:deploy` — aplica todas as migrações do Postgres.
5. `pnpm db:seed` — popula roles, permissões e dados iniciais.

Depois disso a plataforma está pronta para o comando `dev`.

---

## 🧪 Desenvolvimento

### Subir **tudo** de uma vez (apps + serviços, em paralelo)

```bash
pnpm dev
```

Ou, equivalente:

```bash
pnpm dev:full
```

Isso dispara `turbo run dev --parallel` em todos os workspaces que
têm o script `dev` — 8 apps Next.js e 10 microserviços NestJS rodam
simultaneamente com hot reload.

### Subir **apenas o frontend** (`apps/web`)

```bash
pnpm dev:web
```

### Subir **apenas os microserviços** (todos os NestJS)

```bash
pnpm dev:services
```

### Subir **apenas os apps Next.js**

```bash
pnpm dev:apps
```

### Subir **um serviço específico**

```bash
pnpm --filter @devtechs/auth-service dev
pnpm --filter @devtechs/support-service dev
pnpm --filter @devtechs/finance-service dev
pnpm --filter @devtechs/rh-service dev
pnpm --filter @devtechs/projects-service dev
pnpm --filter @devtechs/devops-service dev
pnpm --filter @devtechs/notification-service dev
# ... etc
```

### Portas padrão (dev)

| Serviço / App           | Porta | URL                         |
|-------------------------|-------|-----------------------------|
| web (Next.js)           | 3000  | http://localhost:3000       |
| auth-service            | 3001  | http://localhost:3001       |
| rh-service              | 3002  | http://localhost:3002       |
| finance-service         | 3003  | http://localhost:3003       |
| projects-service        | 3004  | http://localhost:3004       |
| devops-service          | 3005  | http://localhost:3005       |
| support-service         | 3006  | http://localhost:3006       |
| payments-service        | 3007  | http://localhost:3007       |
| notification-service    | 3008  | http://localhost:3008       |
| license-service         | 3009  | http://localhost:3009       |
| developer-service       | 3010  | http://localhost:3010       |

---

## 💾 Banco de dados (Prisma)

```bash
# Regenerar o Prisma Client após alterar schema.prisma
pnpm db:generate

# Aplicar migrações pendentes (equivalente a `prisma migrate deploy`)
pnpm db:migrate:deploy

# Criar uma nova migração em dev (interativo)
pnpm db:migrate

# Rodar o seed (roles, permissões, dados iniciais)
pnpm db:seed

# Abrir o Prisma Studio
pnpm db:studio
```

---

## 🔐 Configurando OAuth (Google / GitHub)

O login via Google e GitHub é **opcional** em desenvolvimento. Quando as
variáveis de ambiente não estão preenchidas os botões OAuth são
automaticamente ocultados na página `/login` — nenhuma configuração extra
é necessária para o fluxo de email + senha funcionar.

Para habilitar um ou ambos os provedores edite `apps/web/.env.local`:

### Google

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) →
   **APIs & Services** → **Credentials**.
2. Clique em **Create Credentials** → **OAuth 2.0 Client ID**.
3. Tipo: **Web Application**.
4. Em **Authorized redirect URIs** adicione:
   - Dev: `http://localhost:3000/api/auth/callback/google`
   - Prod: `https://<seu-dominio>/api/auth/callback/google`
5. Copie o **Client ID** e o **Client Secret** para `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=<seu-client-id>
   GOOGLE_CLIENT_SECRET=<seu-client-secret>
   ```

### GitHub

1. Acesse [github.com](https://github.com) → **Settings** →
   **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Em **Authorization callback URL** informe:
   - Dev: `http://localhost:3000/api/auth/callback/github`
   - Prod: `https://<seu-dominio>/api/auth/callback/github`
3. Clique em **Generate a new client secret** e copie para `.env.local`:
   ```env
   GITHUB_CLIENT_ID=<seu-client-id>
   GITHUB_CLIENT_SECRET=<seu-client-secret>
   ```

### Reiniciar e validar

Após preencher as credenciais:

```bash
# Reiniciar apenas o frontend
pnpm --filter @devtechs/web dev
```

Fluxo esperado para cada provedor:

1. Abrir `/login` → botão do provedor aparece.
2. Clicar → consentimento do provedor → callback NextAuth.
3. NextAuth chama `POST /auth/oauth/login` no auth-service, que cria ou
   vincula a conta e devolve `accessToken` + `refreshToken`.
4. Sessão ativa → redireciona para `/perfil` (cliente) ou `/admin`
   (usuário com role admin).
5. Confirmar que a tabela `OAuthAccount` no Postgres tem o registro novo:
   ```bash
   pnpm db:studio   # abre Prisma Studio em http://localhost:5555
   ```

---

## 🔍 Qualidade e testes

```bash
# Typecheck de todos os workspaces
pnpm typecheck

# Lint em todos os workspaces
pnpm lint

# Rodar testes unitários
pnpm test

# Formatar o código com Prettier
pnpm format
```

---

## 🏗️ Build

```bash
# Build do monorepo inteiro (apps + services + packages)
pnpm build

# Build apenas dos pacotes compartilhados
pnpm build:packages
```

---

## 🌐 Produção

### Opção 1 — Processo nativo por serviço

Após `pnpm build`, cada serviço tem seu próprio script `start` que
executa o bundle compilado:

```bash
# Subir o frontend em produção
pnpm --filter @devtechs/web start

# Subir um serviço NestJS em produção
pnpm --filter @devtechs/auth-service start
pnpm --filter @devtechs/support-service start
# ... etc
```

Rodar **todos** em paralelo (útil para VPS único ou systemd com um
`ExecStart` que chama o monorepo):

```bash
pnpm start
```

### Opção 2 — Docker (recomendado)

O repositório inclui um `Dockerfile.app` (para os apps Next.js) e um
`Dockerfile.service` (para os microserviços NestJS) compartilhados
entre todos os workspaces. A orquestração fica por conta do
`docker-compose.yml` na raiz do monorepo.

```bash
# Build das imagens e sobe o stack completo
docker compose up -d --build

# Tail dos logs
docker compose logs -f

# Parar tudo
docker compose down
```

### Variáveis de ambiente obrigatórias em produção

```
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/devtechs
REDIS_URL=redis://host:6379

JWT_SECRET=<secret-forte-256-bits>
JWT_REFRESH_SECRET=<secret-forte-256-bits>
JWT_2FA_TEMP_SECRET=<secret-forte-256-bits>
AUTH_SECRET=<secret-nextauth>
AUTH_INTERNAL_SECRET=<segredo-compartilhado-entre-services>
ENCRYPTION_KEY=<>=16-chars>

RESEND_API_KEY=re_xxx                        # email
GITHUB_WEBHOOK_SECRET=<hmac-secret>          # devops
GITHUB_API_TOKEN=ghp_xxx                     # devops outbound

AUTH_SERVICE_URL=http://auth-service:3001    # URL interna (docker DNS)
NEXT_PUBLIC_AUTH_SERVICE_URL=https://api.devtechs.com.br

CORS_ORIGINS=https://devtechs.com.br,https://app.devtechs.com.br
```

### Deploy contínuo (GitHub Actions)

O repositório já tem workflows em `.github/workflows/`:

- `ci.yml` — typecheck + lint + test em todo push.
- `build.yml` — build das imagens Docker e push para o registry.
- `deploy.yml` — deploy para o cluster via webhook do devops-service.

O fluxo recomendado:

1. Push na branch `main` dispara `ci.yml`.
2. Após aprovação do PR, `build.yml` gera as imagens.
3. `deploy.yml` envia o evento de deploy via devops-service.
4. O webhook do devops-service atualiza o status no banco e emite
   `pipeline:update` via WebSocket para todos os dashboards abertos.

---

## 🏥 Health checks

Todo serviço NestJS expõe `/health` público (sem JWT):

```bash
curl http://localhost:3001/health   # auth-service
curl http://localhost:3005/health   # devops-service
curl http://localhost:3006/health   # support-service
# ...
```

---

## 🆘 Troubleshooting

### "Redis unreachable" nos logs

O dev-mode tolera Redis ausente. Se você tiver Redis rodando dentro
do WSL2, ajuste `REDIS_HOST` para o IP da distro WSL2 ou exponha a
porta 6379 via port-proxy. Os serviços continuam funcionais mas cache
de permissões e BullMQ ficam desligados.

### "Maximum 5 servers per worktree" no preview

O Claude Code Preview limita cinco dev servers simultâneos. Pare os
que não estiver usando com `preview_stop <serverId>` antes de iniciar
um novo.

### Login retorna 429

O auth-service tem um throttler global (100 req/min por IP) e um
específico de login (5 tentativas/15min). Em dev, reiniciar o
`auth-service` reseta o contador em memória.

### NextAuth reclama que `session.user.email` é nullable

Já resolvido — `apps/web/src/auth.ts` faz cast com `unknown` na
callback `session` porque o schema do DevTechs permite emails null
em contas OAuth não-verificadas.

---

## 📂 Estrutura do monorepo

```
devtechs/
├── apps/                  # Apps Next.js (um por módulo de UI)
│   ├── web/               # Portal principal + landing + dashboards
│   ├── rh/                # Stub — futuro microfrontend de RH
│   ├── financeiro/        # Stub
│   ├── projetos/          # Stub
│   └── ... (suporte, devops, developer, store)
├── services/              # Microserviços NestJS
│   ├── auth-service/      # Auth, OAuth, 2FA, RBAC
│   ├── rh-service/        # HR: employees, vacations, documents
│   ├── finance-service/   # Finance: transactions, invoices, DRE
│   ├── projects-service/  # Projects: kanban, sprints, burndown
│   ├── support-service/   # Support: tickets, SLA, chat WS
│   ├── devops-service/    # DevOps: pipelines, environments, GH webhook
│   ├── notification-service/ # Email (Resend) + in-app + WS push
│   ├── payments-service/  # Stub
│   ├── license-service/   # Stub
│   └── developer-service/ # Stub
├── packages/              # Pacotes compartilhados
│   ├── database/          # Prisma schema + gerador do client
│   ├── ui/                # Design system (Radix + Tailwind)
│   ├── auth/              # Helpers NextAuth
│   ├── types/             # Tipos compartilhados
│   ├── storage/           # Adapter R2 + local filesystem
│   ├── config/            # tsconfig base, ESLint, etc.
│   ├── license-sdk/       # SDK para o license-service
│   └── utils/             # Helpers genéricos
└── infra/                 # Docker, Kubernetes, nginx
```

---

## 🧭 Fluxos principais

- **Autenticação**: web → NextAuth → auth-service `/auth/login`
  → JWT access + refresh → cookie httpOnly.
- **Autorização**: cada service resolve permissões via auth-service
  `/auth/permissions/:userId` com cache Redis 5min + cache in-memory
  30s.
- **Notificações**: serviços publicam em `notifications:email` /
  `notifications:inapp` / `rh:vacation:approved` / `finance:alerts`
  / `support:sla:breach` / `devops:environment:status`, e o
  notification-service consome via Redis subscriber → BullMQ →
  Resend / WebSocket push.
- **Real-time**: support-service `/support` e devops-service
  `/devops` expõem namespaces Socket.io com adapter Redis para
  fan-out cross-instance.
