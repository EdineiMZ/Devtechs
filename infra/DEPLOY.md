# SZDevs — Guia de Deploy na VPS (Hostinger)

Passo a passo completo para colocar o stack em produção no servidor Hostinger.  
Stack: **Docker Compose + nginx + PostgreSQL + Redis + 10 serviços NestJS + 2 apps Next.js**

---

## Pré-requisitos

| Item | Versão mínima |
|------|--------------|
| Ubuntu | 22.04 LTS |
| Docker | 24+ |
| Docker Compose | v2 (plugin, não standalone) |
| Git | qualquer |
| Domínio | `szdevs.com` apontando para o IP da VPS via Cloudflare |

---

## 1. Acesso à VPS via SSH

```bash
ssh root@SEU_IP_DA_VPS
# ou com chave:
ssh -i ~/.ssh/id_rsa root@SEU_IP_DA_VPS
```

Crie um usuário não-root (recomendado):

```bash
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy   # acesso ao Docker sem sudo
su - deploy
```

---

## 2. Instalar Docker

```bash
# Instala Docker Engine + Compose plugin em uma linha
curl -fsSL https://get.docker.com | sh

# Verifica
docker --version          # Docker version 24+
docker compose version    # Docker Compose version v2+
```

---

## 3. Clonar o repositório

```bash
cd /opt
sudo git clone https://github.com/SEU_ORG/szdevs.git szdevs
sudo chown -R deploy:deploy szdevs
cd szdevs
```

Ou se for via SFTP/rsync, envie os arquivos para `/opt/szdevs`.

---

## 4. Certificado TLS — Cloudflare Origin Certificate

Como o domínio usa Cloudflare como proxy, o certificado correto é o **Origin Certificate** (gratuito, válido 15 anos).

**Passos no painel da Cloudflare:**

1. Acesse **dash.cloudflare.com → szdevs.com → SSL/TLS → Origin Server**
2. Clique em **Create Certificate**
3. Escolha cobertura: `szdevs.com, *.szdevs.com`
4. Validade: 15 years
5. Clique em **Create**
6. Copie o conteúdo das duas caixas

**Na VPS:**

```bash
mkdir -p /opt/szdevs/infra/certs

# Cole o conteúdo do "Origin Certificate" aqui:
nano /opt/szdevs/infra/certs/SZDevs.crt

# Cole o conteúdo da "Private Key" aqui:
nano /opt/szdevs/infra/certs/SZDevs.key

chmod 600 /opt/szdevs/infra/certs/SZDevs.key
```

**No painel Cloudflare → SSL/TLS → Overview:**  
Mude o modo para **Full (strict)**.

---

## 5. Configurar variáveis de ambiente

```bash
cd /opt/szdevs
cp .env.example .env
nano .env
```

### Variáveis obrigatórias para produção

```env
# ── Banco de dados ──────────────────────────────────────
POSTGRES_USER=szdevs
POSTGRES_PASSWORD=SENHA_FORTE_AQUI
POSTGRES_DB=szdevs
DATABASE_URL=postgresql://szdevs:SENHA_FORTE_AQUI@postgres:5432/szdevs

# ── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT ─────────────────────────────────────────────────
JWT_SECRET=STRING_ALEATORIA_64_CHARS
JWT_EXPIRES_IN=7d

# ── Auth interno (inter-service) ────────────────────────
AUTH_INTERNAL_SECRET=STRING_ALEATORIA_32_CHARS

# ── URLs públicas (usadas pelo Next.js) ─────────────────
NEXT_PUBLIC_WEB_URL=https://szdevs.com
NEXT_PUBLIC_AUTH_URL=https://szdevs.com/api/auth
NEXT_PUBLIC_AUTH_SERVICE_URL=https://szdevs.com/api/auth
NEXT_PUBLIC_RH_SERVICE_URL=https://szdevs.com/api/rh
NEXT_PUBLIC_FINANCE_URL=https://szdevs.com/api/finance
NEXT_PUBLIC_PROJECTS_SERVICE_URL=https://szdevs.com/api/projects
NEXT_PUBLIC_DEVOPS_SERVICE_URL=https://szdevs.com/api/devops
NEXT_PUBLIC_SUPPORT_URL=https://szdevs.com/api/support
NEXT_PUBLIC_NOTIFICATION_URL=https://szdevs.com/api/notifications
NEXT_PUBLIC_LICENSE_URL=https://szdevs.com/api/license
NEXT_PUBLIC_DEVELOPER_URL=https://szdevs.com/api/developer

# ── URLs internas (servidor → servidor via Docker DNS) ──
AUTH_SERVICE_URL=http://auth-service:3001
RH_SERVICE_URL=http://rh-service:3002
FINANCE_SERVICE_URL=http://finance-service:3003
PROJECTS_SERVICE_URL=http://projects-service:3004
DEVOPS_SERVICE_URL=http://devops-service:3005
SUPPORT_SERVICE_URL=http://support-service:3006
PAYMENTS_SERVICE_URL=http://payments-service:3007
NOTIFICATION_SERVICE_URL=http://notification-service:3008
LICENSE_SERVICE_URL=http://license-service:3009
DEVELOPER_SERVICE_URL=http://developer-service:3010

# ── Next Auth ───────────────────────────────────────────
NEXTAUTH_URL=https://szdevs.com
NEXTAUTH_SECRET=STRING_ALEATORIA_32_CHARS

# ── OAuth (GitHub) ──────────────────────────────────────
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# ── OAuth (Google) ──────────────────────────────────────
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# ── Email — Resend ──────────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM=SZDevs <no-reply@szdevs.com>

# ── Pagamentos — Stripe ─────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_MP_PUBLIC_KEY=...   # Mercado Pago, se usado

# ── Licenças ────────────────────────────────────────────
LICENSE_SIGNING_KEY=...
LICENSE_PUBLIC_KEY=...

# ── Storage (MinIO / S3 compatível) ─────────────────────
STORAGE_ENDPOINT=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_BUCKET=szdevs

# ── Node ────────────────────────────────────────────────
NODE_ENV=production
```

> **Dica:** Gere strings aleatórias seguras com:  
> `openssl rand -base64 48 | tr -d '/+=' | cut -c1-64`

---

## 6. Rodar as migrations do banco

As migrations precisam rodar **uma vez** antes de subir os serviços, ou o Prisma cuida automaticamente se configurado no entrypoint.

```bash
cd /opt/szdevs

# Sobe só o banco temporariamente
docker compose up -d postgres

# Aguarda ficar healthy
docker compose ps

# Roda as migrations
docker compose run --rm auth-service sh -c "npx prisma migrate deploy"
# ou a partir do host se tiver Node instalado:
# DATABASE_URL=... npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

# Para o banco (o compose:prod vai reiniciá-lo)
docker compose stop postgres
```

---

## 7. Build e inicialização

```bash
cd /opt/szdevs

# Build de todas as imagens (pode demorar 5-15 min no primeiro build)
docker compose --profile prod build

# Sobe tudo em background
docker compose --profile prod up -d

# Acompanha os logs
docker compose logs -f --tail=50
```

---

## 8. Verificar o deploy

```bash
# Todos os containers rodando?
docker compose ps

# Health check do nginx
curl -s http://localhost/health
# → {"status":"ok"}

# Testar HTTPS (de fora, com o domínio já propagado)
curl -s https://szdevs.com/health
# → {"status":"ok"}

# Logs de um serviço específico
docker compose logs auth-service --tail=100
```

---

## 9. Firewall (UFW)

Libere apenas as portas necessárias:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Os serviços internos (3001-3010, 5432, 6379) **não devem ser expostos** para fora — o Docker Compose já os mantém na rede interna `SZDevs`.

---

## 10. Cloudflare — configurações finais

| Configuração | Valor |
|---|---|
| SSL/TLS mode | **Full (strict)** |
| Always Use HTTPS | **On** |
| HTTP/3 | **On** (opcional) |
| Minimum TLS Version | **TLS 1.2** |

DNS → confirme que o registro `A @ 2.57.91.91` está com a **nuvem laranja 🟠** (proxy ativo).

---

## 11. Atualizações futuras

Para deployar uma nova versão:

```bash
cd /opt/szdevs

# Puxa o código novo
git pull origin main

# Rebuilda só o que mudou
docker compose --profile prod build

# Reinicia com zero downtime (rolling restart por serviço)
docker compose --profile prod up -d --no-deps --build web auth-service

# Ou reinicia tudo
docker compose --profile prod up -d
```

---

## 12. Comandos úteis

```bash
# Ver uso de recursos
docker stats

# Entrar num container
docker exec -it SZDevs-auth-service sh

# Ver logs em tempo real
docker compose logs -f notification-service

# Parar tudo
docker compose --profile prod down

# Parar e apagar volumes (CUIDADO: apaga banco!)
docker compose --profile prod down -v

# Backup do banco
docker exec SZDevs-postgres pg_dump -U szdevs szdevs > backup_$(date +%F).sql
```

---

## Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---|---|---|
| 502 Bad Gateway | Serviço não iniciou | `docker compose logs <serviço>` |
| Certificado inválido | Cloudflare não em Full (strict) | Mudar SSL mode no Cloudflare |
| CORS error no browser | `CORS_ORIGINS` incompleto no `.env` | Adicionar URL e reiniciar |
| DB connection refused | `DATABASE_URL` errada ou postgres não healthy | `docker compose ps postgres` |
| Build falhou (pnpm) | Cache corrompido | `docker compose build --no-cache` |
