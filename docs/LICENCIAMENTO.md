# Sistema de Licenciamento SZDevs

## Visao Geral

O license-service gerencia tokens de ativacao para produtos SZDevs. Cada token e um UUID v4 com hash SHA-256 armazenado para verificacao offline.

## Fluxo

```
Admin cria produto â†’ Admin vincula cliente â†’ Admin gera token
                                              â†“
                                    Entrega key + hash ao cliente
                                              â†“
                            Produto do cliente chama POST /tokens/verify
                                              â†“
                              license-service valida e registra ativacao
```

## Endpoints

### Produtos (requer auth)

| Metodo | Rota | Permissao | Descricao |
|--------|------|-----------|-----------|
| GET | /products | licenses:audit:view | Lista produtos |
| POST | /products | dev:config:edit | Cria produto |

### Clientes (requer auth)

| Metodo | Rota | Permissao | Descricao |
|--------|------|-----------|-----------|
| POST | /clients/:clientId/bind | licenses:clients:bind | Vincula cliente a produto |
| GET | /clients/:clientId/tokens | licenses:audit:view | Lista tokens do cliente |

### Tokens (requer auth exceto verify)

| Metodo | Rota | Permissao | Descricao |
|--------|------|-----------|-----------|
| POST | /tokens | licenses:tokens:generate | Gera token |
| POST | /tokens/verify | **publico** | Verifica token |
| PUT | /tokens/:id/revoke | licenses:tokens:revoke | Revoga token |
| GET | /tokens | licenses:audit:view | Lista tokens com filtros |

## Gerando um Token

```bash
curl -X POST http://localhost:3008/tokens \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "user_abc123",
    "productId": "prod_xyz789",
    "maxUses": 5,
    "expiresAt": "2027-01-01T00:00:00Z"
  }'
```

Resposta:

```json
{
  "key": "550e8400-e29b-41d4-a716-446655440000",
  "hash": "a1b2c3d4e5f6...64 chars hex",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "maxUses": 5
}
```

## Verificando um Token (POST /tokens/verify)

Endpoint publico â€” chamado pelo produto do cliente, sem Bearer token.

```bash
curl -X POST http://localhost:3008/tokens/verify \
  -H "Content-Type: application/json" \
  -d '{
    "key": "550e8400-e29b-41d4-a716-446655440000",
    "appId": "my-saas-app",
    "hardwareId": "HW-ABC-123"
  }'
```

Resposta valida:

```json
{
  "valid": true,
  "clientId": "user_abc123",
  "product": {
    "id": "prod_xyz789",
    "name": "My SaaS App",
    "appId": "my-saas-app"
  },
  "expiresAt": "2027-01-01T00:00:00.000Z"
}
```

Resposta invalida:

```json
{
  "valid": false,
  "reason": "Token has expired"
}
```

### Verificacoes realizadas

1. Token existe
2. `appId` confere com o produto vinculado
3. Status e `ACTIVE`
4. Nao expirou (`expiresAt`)
5. Usos nao esgotados (`usedCount < maxUses`)
6. `hardwareId` confere (se o token tem binding de hardware)

## Hash SHA-256 e Verificacao Offline

Cada token gerado produz um hash SHA-256 do UUID:

```
key  = "550e8400-e29b-41d4-a716-446655440000"
hash = SHA-256(key) = "a1b2c3d4..."
```

### Como funciona

O hash e computado assim (Node.js):

```ts
import { createHash } from 'crypto';

function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
```

### Verificacao offline

Para ambientes sem internet (air-gapped), armazene o `hash` retornado na geracao do token. O produto pode verificar a autenticidade da key sem chamar a API:

```ts
import { verifyOffline } from '@szdevs/license-sdk';

// savedHash foi armazenado durante a ativacao inicial
const isAuthentic = verifyOffline(userProvidedKey, savedHash);
```

**Limitacoes da verificacao offline:**

- Nao verifica expiracao (`expiresAt`)
- Nao verifica limite de usos (`maxUses`)
- Nao verifica revogacao (`status`)
- Nao verifica binding de hardware

Use verificacao offline apenas como fallback quando o servico esta inacessivel. Sempre prefira a verificacao online via `POST /tokens/verify`.

### Fluxo recomendado

```
1. Na primeira execucao:
   - Chama POST /tokens/verify (online)
   - Se valido, salva o hash localmente

2. Nas execucoes seguintes:
   - Tenta verificacao online
   - Se falhar (rede indisponivel):
     - Usa verifyOffline(key, savedHash)
     - Considera valido por ate 24h sem verificacao online
```

## Usando o SDK (@szdevs/license-sdk)

### Instalacao

```bash
npm install @szdevs/license-sdk
# ou
pnpm add @szdevs/license-sdk
```

### Verificacao online

```ts
import { LicenseClient } from '@szdevs/license-sdk';

const client = new LicenseClient({
  baseUrl: 'https://api.SZDevs.com.br',
  appId: 'my-saas-app',
  timeout: 10000, // opcional, default 10s
});

async function checkLicense(key: string) {
  const result = await client.verify(key, {
    hardwareId: getHardwareFingerprint(), // opcional
  });

  if (result.valid) {
    console.log('Licenca valida');
    console.log('Cliente:', result.clientId);
    console.log('Produto:', result.product?.name);
    console.log('Expira:', result.expiresAt ?? 'nunca');
  } else {
    console.error('Licenca invalida:', result.reason);
    // Bloquear acesso ou degradar funcionalidades
  }
}
```

### Verificacao offline (fallback)

```ts
import { hashKey, verifyOffline } from '@szdevs/license-sdk';

// Gerar hash para armazenar
const hash = hashKey('550e8400-e29b-41d4-a716-446655440000');

// Verificar offline
const valid = verifyOffline(userKey, storedHash);
```

## Webhooks (Redis pub/sub)

O license-service publica eventos nos canais:

| Canal | Quando |
|-------|--------|
| `license:activated` | Token verificado com sucesso |
| `license:revoked` | Token revogado |
| `license:expiring:soon` | Token expira em 7 dias (cron diario 8h) |

## Porta padrao

```
LICENSE_SERVICE_PORT=3008
```
