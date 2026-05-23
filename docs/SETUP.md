# SZDevs — Guia de Setup Manual

> **Configuração automática disponível:** execute `./setup.sh` (Linux/macOS) ou `setup.bat` (Windows) para configurar o ambiente em um único comando.

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Clonar o repositório](#2-clonar-o-repositório)
3. [Configurar variáveis de ambiente](#3-configurar-variáveis-de-ambiente)
4. [Instalar dependências](#4-instalar-dependências)
5. [Banco de dados e migrations](#5-banco-de-dados-e-migrations)
6. [Modo desenvolvimento (sem Docker)](#6-modo-desenvolvimento-sem-docker)
7. [Modo Docker completo](#7-modo-docker-completo)
8. [Verificar a instalação](#8-verificar-a-instalação)
9. [Ferramentas de desenvolvimento opcionais](#9-ferramentas-de-desenvolvimento-opcionais)
10. [Configuração de serviços externos](#10-configuração-de-serviços-externos)
11. [Referência de comandos úteis](#11-referência-de-comandos-úteis)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Pré-requisitos

| Ferramenta | Versão mínima | Como instalar |
|------------|--------------|---------------|
| **Node.js** | 18.17.0+ | [nodejs.org](https://nodejs.org) |
| **pnpm** | 9.0.0+ | `npm install -g pnpm@9` ou `corepack enable` |
| **Docker** | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2 (plugin) | Incluído no Docker Desktop / `apt install docker-compose-plugin` |
| **Git** | qualquer | [git-scm.com](https://git-scm.com) |

> **Windows:** Recomendamos WSL2 + Docker Desktop. O PowerShell 7+ também é suportado.

---

## 2. Clonar o repositório

```bash
git clone https://github.com/EdineiMZ/Devtechs.git szdevs
cd szdevs
```

---

## 3. Configurar variáveis de ambiente

### 3.1 Copiar o template

```bash
cp .env.example .env
```

### 3.2 Segredos obrigatórios

Abra o `.env` e preencha os valores abaixo. Os demais podem ficar com os padrões para desenvolvimento.

#### Banco de dados

```env
POSTGRES_USER=szdevs
POSTGRES_PASSWORD=SUA_SENHA_FORTE_AQUI
POSTGRES_DB=szdevs
DATABASE_URL=postgresql://szdevs:SUA_SENHA_FORTE_AQUI@postgres:5432/szdevs
```

> **Dev local sem Docker:** use `localhost` no lugar de `postgres`.  
> `DATABASE_URL=postgresql://szdevs:senha@localhost:5432/szdevs`

#### Segredos de autenticação

Gere strings aleatórias seguras:

**Linux/macOS:**
```bash
openssl rand -base64 48 | tr -d '/+=' | cut -c1-64
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48)) -replace '[+/=]',''
```

Preencha no `.env`:

```env
JWT_SECRET=<string de 64 chars>
JWT_REFRESH_SECRET=<string de 64 chars>
NEXTAUTH_SECRET=<string de 48 chars>
ENCRYPTION_KEY=<string de EXATAMENTE 32 chars>
AUTH_INTERNAL_SECRET=<string de 48 chars>
```

> ⚠️ **CRÍTICO: `ENCRYPTION_KEY`** — deve ter exatamente 32 caracteres e ser idêntica no `.env` raiz e em `infra/.env`. Uma chave diferente entre os dois arquivos causa falha silenciosa no 2FA.

#### NextAuth

```env
NEXTAUTH_URL=http://localhost:4000
NEXTAUTH_SECRET=<gerado acima>
```

### 3.3 Variáveis opcionais para desenvolvimento

Para o ambiente de desenvolvimento local básico, as variáveis abaixo **não são necessárias** no início:

- OAuth (GitHub, Google) — login social
- Stripe / Mercado Pago — pagamentos
- SMTP / Resend — e-mails
- Storage (MinIO/R2) — upload de arquivos
- Hostinger API — gerenciamento VPS

Consulte a [Seção 10](#10-configuração-de-serviços-externos) para configurá-las.

---

## 4. Instalar dependências

```bash
pnpm install
```

Isso instala todas as dependências do monorepo (apps, serviços, pacotes compartilhados) e executa automaticamente a geração do Prisma Client via `postinstall`.

Para gerar o Prisma Client manualmente:

```bash
pnpm db:generate
```

---

## 5. Banco de dados e migrations

### 5.1 Subir o PostgreSQL via Docker

```bash
cd infra
docker compose up -d postgres redis
cd ..
```

Verifique se está saudável:

```bash
docker compose -f infra/docker-compose.yml ps
# postgres deve mostrar "(healthy)"
```

### 5.2 Executar as migrations

```bash
pnpm db:migrate
```

### 5.3 Popular com dados de exemplo (opcional)

```bash
pnpm db:seed
```

### 5.4 Prisma Studio (GUI do banco)

```bash
pnpm db:studio
# Abre em http://localhost:5555
```

---

## 6. Modo desenvolvimento (sem Docker para os serviços)

Neste modo, apenas PostgreSQL e Redis rodam em Docker. Os serviços NestJS e apps Next.js rodam nativamente no host com hot-reload.

### 6.1 Iniciar tudo de uma vez

```bash
pnpm dev
```

Isso usa o Turborepo para iniciar todos os serviços e apps em paralelo.

### 6.2 Iniciar partes específicas

```bash
# Só os frontends
pnpm dev:apps

# Só os backends (NestJS)
pnpm dev:services

# Um serviço específico
pnpm --filter @szdevs/auth-service dev
pnpm --filter @szdevs/web dev
```

### 6.3 URLs de desenvolvimento

| Serviço | URL |
|---------|-----|
| **Web (admin + perfil)** | http://localhost:4000 |
| **Store (planos/checkout)** | http://localhost:4006 |
| **auth-service API** | http://localhost:3001 |
| **rh-service API** | http://localhost:3002 |
| **finance-service API** | http://localhost:3003 |
| **projects-service API** | http://localhost:3004 |
| **devops-service API** | http://localhost:3005 |
| **support-service API** | http://localhost:3006 |
| **payments-service API** | http://localhost:3007 |
| **notification-service API** | http://localhost:3008 |
| **license-service API** | http://localhost:3009 |
| **developer-service API** | http://localhost:3010 |
| **PostgreSQL** | localhost:5432 |
| **Redis** | localhost:6379 |

### 6.4 Ajuste de URLs para dev local

Quando os serviços rodam no host (não em Docker), as URLs internas precisam usar `localhost`:

```env
# Em desenvolvimento local, sobrescreva no .env:
AUTH_SERVICE_URL=http://localhost:3001
RH_SERVICE_URL=http://localhost:3002
# ... demais serviços
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3001
# ... demais NEXT_PUBLIC_*
```

---

## 7. Modo Docker completo

Neste modo, toda a aplicação roda em containers (simulando produção).

### 7.1 Build das imagens

```bash
cd infra
docker compose --profile prod build
```

O primeiro build pode demorar 10–20 minutos (download de layers + compilação TypeScript).

### 7.2 Subir o stack

```bash
docker compose --profile prod up -d
```

### 7.3 Executar migrations (primeira vez)

```bash
docker compose --profile migrate run --rm migrate
```

### 7.4 Acompanhar logs

```bash
docker compose logs -f --tail=50
# ou de um serviço específico:
docker compose logs -f auth-service
```

### 7.5 Verificar saúde dos containers

```bash
docker compose ps
```

Todos os serviços devem mostrar `(healthy)` após ~60 segundos.

---

## 8. Verificar a instalação

```bash
# Health check do nginx (modo Docker)
curl http://localhost/health
# → {"status":"ok"}

# Health check direto de um serviço (modo dev)
curl http://localhost:3001/health
# → {"status":"ok","service":"auth-service"}

# Testar a API de autenticação
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@szdevs.com","password":"admin123"}'
```

---

## 9. Ferramentas de desenvolvimento opcionais

Suba com:

```bash
cd infra
docker compose --profile dev-tools up -d
```

| Ferramenta | URL | Uso |
|------------|-----|-----|
| **Adminer** | http://localhost:8080 | GUI para PostgreSQL |
| **Mailhog** | http://localhost:8025 | Captura e-mails de dev |
| **Prisma Studio** | http://localhost:5555 | GUI do ORM |

Para usar o Mailhog, configure no `.env`:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
```

---

## 10. Configuração de serviços externos

### 10.1 OAuth — GitHub

1. Acesse https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. **Homepage URL:** `http://localhost:4000`
3. **Authorization callback URL:** `http://localhost:4000/api/auth/callback/github`
4. Copie o `Client ID` e gere um `Client Secret`

```env
GITHUB_CLIENT_ID=SEU_CLIENT_ID
GITHUB_CLIENT_SECRET=SEU_CLIENT_SECRET
```

### 10.2 OAuth — Google

1. Acesse https://console.cloud.google.com → **APIs & Services** → **Credentials**
2. Crie **OAuth 2.0 Client ID** do tipo **Web Application**
3. **Authorized redirect URIs:** `http://localhost:4000/api/auth/callback/google`

```env
GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
```

### 10.3 E-mail — Resend (recomendado)

1. Crie conta em https://resend.com
2. Gere uma API Key

```env
RESEND_API_KEY=re_SUA_CHAVE
RESEND_FROM=SZDevs <no-reply@seudominio.com>
```

### 10.4 E-mail — SMTP genérico

```env
SMTP_HOST=smtp.gmail.com      # ou outro provedor
SMTP_PORT=587
SMTP_USER=seuemail@gmail.com
SMTP_PASS=SUA_SENHA_APP
SMTP_FROM="SZDevs <seuemail@gmail.com>"
```

> Para Gmail, use uma [Senha de App](https://myaccount.google.com/apppasswords), não a senha da conta.

### 10.5 Pagamentos — Stripe

1. Crie conta em https://stripe.com → **Developers** → **API Keys**
2. Para webhooks locais: `npx stripe listen --forward-to localhost:3007/webhooks/stripe`

```env
STRIPE_SECRET_KEY=sk_test_SUA_CHAVE
STRIPE_WEBHOOK_SECRET=whsec_SUA_CHAVE
STRIPE_PUBLISHABLE_KEY=pk_test_SUA_CHAVE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_SUA_CHAVE
```

### 10.6 Pagamentos — Mercado Pago

1. Acesse https://www.mercadopago.com.br/developers → **Credenciais**

```env
MP_ACCESS_TOKEN=SEU_ACCESS_TOKEN
MP_WEBHOOK_SECRET=SEU_WEBHOOK_SECRET
NEXT_PUBLIC_MP_PUBLIC_KEY=SUA_PUBLIC_KEY
```

### 10.7 Storage — MinIO local

Para desenvolvimento local de uploads:

```bash
cd infra
docker compose --profile dev-tools up -d
```

```env
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=szdevs
```

Acesse a interface MinIO em http://localhost:9001 (usuário: `minioadmin`, senha: `minioadmin`).

### 10.8 Storage — Cloudflare R2 (produção)

1. Acesse https://dash.cloudflare.com → **R2** → **Create Bucket**
2. Crie as chaves de API: **R2** → **Manage R2 API Tokens**

```env
STORAGE_ENDPOINT=https://SEU_ACCOUNT_ID.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=SEU_ACCESS_KEY_ID
STORAGE_SECRET_KEY=SEU_SECRET_ACCESS_KEY
STORAGE_BUCKET=szdevs
```

### 10.9 Licenciamento — Chaves Ed25519

Gere o par de chaves Ed25519:

```bash
node -e "
const c = require('crypto');
const { privateKey, publicKey } = c.generateKeyPairSync('ed25519');
console.log('PRIVATE:', privateKey.export({ type: 'pkcs8', format: 'pem' }));
console.log('PUBLIC:', publicKey.export({ type: 'spki', format: 'pem' }));
"
```

```env
LICENSE_SIGNING_KEY=-----BEGIN PRIVATE KEY-----\n...
LICENSE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...
```

---

## 11. Referência de comandos úteis

### Desenvolvimento

```bash
pnpm dev                     # Todos os servidores em paralelo
pnpm dev:web                 # Só web (Next.js)
pnpm dev:store               # Só store (Next.js)
pnpm dev:services            # Só backends NestJS
pnpm dev:apps                # Só frontends Next.js
```

### Build

```bash
pnpm build                   # Build completo (Turborepo)
pnpm build:packages          # Só pacotes compartilhados
pnpm --filter @szdevs/web build   # Build de um app específico
```

### Banco de dados

```bash
pnpm db:generate             # Gerar Prisma Client
pnpm db:migrate              # Criar/aplicar migrations
pnpm db:migrate:deploy       # Aplicar migrations (produção)
pnpm db:seed                 # Popular com dados de exemplo
pnpm db:studio               # Abrir Prisma Studio (GUI)
```

### Testes

```bash
pnpm test                    # Testes unitários (Jest)
pnpm test:integration        # Testes de integração
pnpm test:e2e                # Testes E2E (Playwright)
pnpm typecheck               # Verificação de tipos TypeScript
pnpm lint                    # ESLint
```

### Docker

```bash
# Infra apenas (dev)
cd infra && docker compose up -d

# Stack completo (prod)
cd infra && docker compose --profile prod up -d

# Ferramentas de dev
cd infra && docker compose --profile dev-tools up -d

# Migrations
cd infra && docker compose --profile migrate run --rm migrate

# Parar tudo
cd infra && docker compose --profile prod down

# Parar e apagar volumes (CUIDADO: apaga o banco)
cd infra && docker compose --profile prod down -v

# Rebuild sem cache
cd infra && docker compose --profile prod build --no-cache
```

### Infraestrutura (atalhos do package.json)

```bash
pnpm infra:reset             # Reset completo (Docker + migrations + seed)
pnpm infra:reset:redis       # Limpar Redis
pnpm infra:reset:postgres    # Reset do banco (CUIDADO: apaga dados)
```

### Backup do banco

```bash
docker exec SZDevs-postgres pg_dump -U szdevs szdevs > backup_$(date +%F).sql
# Restaurar:
docker exec -i SZDevs-postgres psql -U szdevs szdevs < backup_2026-05-23.sql
```

---

## 12. Troubleshooting

### `pnpm install` falha com erros de permissão

```bash
# Linux/macOS — ajuste o dono do diretório
sudo chown -R $USER:$USER .
pnpm install
```

### PostgreSQL "connection refused"

1. Certifique-se de que os containers estão rodando: `docker compose -f infra/docker-compose.yml ps`
2. Em modo dev local, use `localhost` no `DATABASE_URL`, não `postgres`
3. Verifique a senha no `.env` vs o container: `docker exec SZDevs-postgres env | grep POSTGRES`

### Erro de migrations Prisma "schema drift"

```bash
# Redefine o banco (APAGA todos os dados)
pnpm infra:reset:postgres
```

### 2FA não funciona após setup

A causa mais comum é `ENCRYPTION_KEY` diferente entre `.env` e `infra/.env`.

```bash
# Verificar se as chaves são idênticas
grep ENCRYPTION_KEY .env infra/.env

# Verificar o que o container está usando
docker exec SZDevs-auth-service env | grep ENCRYPTION_KEY
```

A chave canônica é sempre a do `.env` raiz. Copie-a para `infra/.env` se houver divergência.

### Serviço NestJS não inicia ("Cannot find module")

```bash
# Gerar pacotes compartilhados primeiro
pnpm build:packages
pnpm db:generate
```

### Build Docker falha (pnpm cache)

```bash
cd infra
docker compose --profile prod build --no-cache
```

### `CORS error` no browser

Adicione a URL do frontend no `.env`:

```env
CORS_ORIGINS=http://localhost:4000,http://localhost:4006,http://SEU_DOMINIO
```

E reinicie o serviço correspondente.

### Portas já em uso

```bash
# Descubra qual processo usa a porta
lsof -i :3001      # Linux/macOS
netstat -ano | findstr :3001   # Windows

# Mate o processo ou mude a porta no .env (ex: AUTH_SERVICE_PORT=13001)
```

---

## Próximos passos

- **Deploy em produção:** consulte [`infra/DEPLOY.md`](../infra/DEPLOY.md)
- **Arquitetura e fluxos:** consulte [`README.md`](../README.md)
- **Desenvolvimento e padrões:** consulte [`docs/DESENVOLVIMENTO.md`](DESENVOLVIMENTO.md)
- **Sistema de licenciamento:** consulte [`docs/LICENCIAMENTO.md`](LICENCIAMENTO.md)
