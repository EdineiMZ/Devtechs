# SZDevs License SDK — Guia de Integração

Versão: 2.0 | Serviço: `license-service` (porta 4007) | SDK: `@szdevs/license-sdk`

---

## Visão Geral

O sistema de licenças da SZDevs permite distribuir e validar tokens de ativação para produtos de software. Cada token é um UUID v4 único com hash SHA-256 armazenado separadamente — o que permite verificação tanto online (via API) quanto offline (comparação de hash).

```
Fluxo principal:

  Admin Panel                license-service              Cliente (SDK)
     │                            │                            │
     ├── POST /clients/:id/bind → │                            │
     ├── POST /tokens ──────────→ │ ← retorna key + hash       │
     │   (emite token p/ cliente) │                            │
     │                            │                            │
     │                            │ ←── POST /tokens/verify ───┤
     │                            │    { key, appId, hwId }    │
     │                            ├──────────────────────────→ │
     │                            │    { valid, clientId, ... } │
```

---

## 1. SDK TypeScript/Node.js

### Instalação

O pacote ainda não está publicado no npm — use via monorepo (workspace) ou copie manualmente.

```bash
# dentro do monorepo SZDevs
pnpm add @szdevs/license-sdk
```

Para uso externo, distribua os arquivos compilados de `packages/license-sdk/src/`.

### Uso básico

```typescript
import { LicenseClient } from '@szdevs/license-sdk';

const client = new LicenseClient({
  baseUrl: 'https://api.szdevs.com',
  appId: 'meu-produto',         // deve coincidir com o appId cadastrado
});

const result = await client.verify('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');

if (result.valid) {
  console.log('Licença válida');
  console.log('Cliente:', result.clientId);
  console.log('Produto:', result.product?.name);
  console.log('Expira em:', result.expiresAt ?? 'Sem expiração');
} else {
  console.error('Licença inválida:', result.reason);
  // Possíveis razões:
  //   "Token not found"
  //   "Token is revoked"
  //   "Token has expired"
  //   "Token usage limit reached"
  //   "Token is bound to a different hardware"
  //   "Token does not belong to this application"
  //   "HTTP 429: Too Many Requests"
  //   "Network error: ..."
}
```

### Com hardware binding e versionamento

```typescript
import { LicenseClient } from '@szdevs/license-sdk';

// Hardware ID pode ser qualquer string única da máquina:
// MAC address, UUID do disco, hash do sistema, etc.
const hardwareId = getHardwareFingerprint(); // implementação própria

const client = new LicenseClient({
  baseUrl: 'https://api.szdevs.com',
  appId: 'meu-produto',
});

const result = await client.verify(licenseKey, {
  hardwareId,
  appVersion: '2.1.0',  // gravado no audit log para rastreamento
});
```

### Com cache em memória (recomendado em produção)

Evita chamadas repetidas à API para a mesma key. Apenas resultados `valid=true`
são cacheados — revogações e expirações são sempre re-verificadas.

```typescript
import { LicenseClient, MemoryCache } from '@szdevs/license-sdk';

const client = new LicenseClient({
  baseUrl: 'https://api.szdevs.com',
  appId: 'meu-produto',
  cache: new MemoryCache({
    ttlSeconds: 300,   // cache por 5 minutos (padrão)
    maxEntries: 1000,  // limite de entradas (padrão)
  }),
});

// Primeira chamada: vai à API
const r1 = await client.verify(key, { hardwareId });
// Segunda chamada (dentro de 5 min): retorna do cache sem rede
const r2 = await client.verify(key, { hardwareId });
```

### Com retry automático

```typescript
const client = new LicenseClient({
  baseUrl: 'https://api.szdevs.com',
  appId: 'meu-produto',
  retries: 3,           // tentativas extras em erros de rede (padrão: 2)
  retryDelayMs: 1000,   // delay base em ms com back-off exponencial (padrão: 500)
  timeout: 15_000,      // timeout por requisição em ms (padrão: 10000)
});
```

### Verificação offline

Use quando o aplicativo não tem acesso à internet. O hash SHA-256 deve ter sido
salvo no momento da ativação inicial (o backend retorna o hash junto com a key).

```typescript
import { verifyOffline, hashKey } from '@szdevs/license-sdk';

// Guarde o hash na primeira ativação (vem da API ao gerar o token):
const savedHash = '4b5c6d7e8f...'; // 64 chars hex, salvo localmente

// Verificação offline — não checa revogação, expiração ou limite de uso
const isValid = verifyOffline(userKey, savedHash);

if (!isValid) {
  console.error('Chave de licença inválida');
}
```

> **Importante**: verificação offline não detecta revogação, expiração ou esgotamento
> de usos. Use apenas como fallback quando não há conectividade.

---

## 2. REST API (sem SDK)

O endpoint de verificação é público — nenhuma autenticação necessária.

**Rate limit**: 30 requisições/minuto por IP.

### Verificar token

```http
POST /tokens/verify
Content-Type: application/json

{
  "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "appId": "meu-produto",
  "hardwareId": "AA:BB:CC:DD:EE:FF",   // opcional
  "appVersion": "1.0.0"                // opcional, gravado no log
}
```

**Resposta — válida (200):**
```json
{
  "valid": true,
  "clientId": "uuid-do-cliente",
  "product": {
    "id": "uuid-do-produto",
    "name": "Meu Produto",
    "appId": "meu-produto"
  },
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Resposta — inválida (200):**
```json
{
  "valid": false,
  "reason": "Token has expired"
}
```

> A API sempre retorna HTTP 200 para o endpoint de verificação. O campo `valid`
> indica o resultado. HTTP 4xx/5xx indicam erros de rede ou rate limit.

---

## 3. Integração em Python

```python
import requests
from typing import Optional

class LicenseClient:
    def __init__(self, base_url: str, app_id: str, timeout: int = 10):
        self.base_url = base_url.rstrip('/')
        self.app_id = app_id
        self.timeout = timeout

    def verify(
        self,
        key: str,
        hardware_id: Optional[str] = None,
        app_version: Optional[str] = None,
    ) -> dict:
        payload = {'key': key, 'appId': self.app_id}
        if hardware_id:
            payload['hardwareId'] = hardware_id
        if app_version:
            payload['appVersion'] = app_version

        try:
            resp = requests.post(
                f'{self.base_url}/tokens/verify',
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except requests.Timeout:
            return {'valid': False, 'reason': 'Network timeout'}
        except requests.RequestException as e:
            return {'valid': False, 'reason': f'Network error: {e}'}


# Uso:
client = LicenseClient('https://api.szdevs.com', 'meu-produto')
result = client.verify('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')

if result.get('valid'):
    print(f"Licença válida para cliente: {result['clientId']}")
else:
    print(f"Licença inválida: {result.get('reason')}")
```

### Verificação offline em Python

```python
import hashlib
import hmac

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode('utf-8')).hexdigest()

def verify_offline(key: str, expected_hash: str) -> bool:
    """Comparação em tempo constante para evitar timing attacks."""
    computed = hash_key(key)
    return hmac.compare_digest(computed, expected_hash)
```

---

## 4. Integração em Go

```go
package license

import (
    "bytes"
    "crypto/sha256"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type Client struct {
    BaseURL string
    AppID   string
    Timeout time.Duration
}

type VerifyRequest struct {
    Key        string  `json:"key"`
    AppID      string  `json:"appId"`
    HardwareID *string `json:"hardwareId,omitempty"`
    AppVersion *string `json:"appVersion,omitempty"`
}

type ProductInfo struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    AppID string `json:"appId"`
}

type VerifyResponse struct {
    Valid     bool        `json:"valid"`
    Reason    string      `json:"reason,omitempty"`
    ClientID  string      `json:"clientId,omitempty"`
    Product   *ProductInfo `json:"product,omitempty"`
    ExpiresAt *string     `json:"expiresAt,omitempty"`
}

func (c *Client) Verify(key string, hardwareID, appVersion *string) (*VerifyResponse, error) {
    req := VerifyRequest{
        Key:        key,
        AppID:      c.AppID,
        HardwareID: hardwareID,
        AppVersion: appVersion,
    }

    body, _ := json.Marshal(req)
    httpClient := &http.Client{Timeout: c.Timeout}

    resp, err := httpClient.Post(
        c.BaseURL+"/tokens/verify",
        "application/json",
        bytes.NewBuffer(body),
    )
    if err != nil {
        return &VerifyResponse{Valid: false, Reason: "network error: " + err.Error()}, nil
    }
    defer resp.Body.Close()

    var result VerifyResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode response: %w", err)
    }
    return &result, nil
}

// HashKey computes the SHA-256 hex digest of a license key.
func HashKey(key string) string {
    h := sha256.Sum256([]byte(key))
    return fmt.Sprintf("%x", h)
}

// VerifyOffline checks a key against a pre-stored SHA-256 hash.
// Does not check revocation, expiry, or usage limits.
func VerifyOffline(key, expectedHash string) bool {
    computed := HashKey(key)
    if len(computed) != len(expectedHash) {
        return false
    }
    // Constant-time comparison
    var diff byte
    for i := range computed {
        diff |= computed[i] ^ expectedHash[i]
    }
    return diff == 0
}

// Uso:
// client := &license.Client{
//     BaseURL: "https://api.szdevs.com",
//     AppID:   "meu-produto",
//     Timeout: 10 * time.Second,
// }
// hw := "AA:BB:CC:DD:EE:FF"
// ver := "1.0.0"
// result, err := client.Verify("key-uuid", &hw, &ver)
```

---

## 5. Integração via cURL

```bash
# Verificar token
curl -X POST https://api.szdevs.com/tokens/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "appId": "meu-produto",
    "hardwareId": "AA:BB:CC:DD:EE:FF",
    "appVersion": "1.0.0"
  }'

# Resposta esperada (válida):
# {"valid":true,"clientId":"...","product":{"id":"...","name":"Meu Produto","appId":"meu-produto"},"expiresAt":null}

# Resposta esperada (inválida):
# {"valid":false,"reason":"Token has expired"}
```

---

## 6. Hardware Fingerprinting

A função de fingerprint é responsabilidade da aplicação cliente.
Recomendações por plataforma:

### Node.js
```typescript
import { createHash } from 'crypto';
import { networkInterfaces } from 'os';

function getHardwareId(): string {
  const nets = networkInterfaces();
  const macs: string[] = [];
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        macs.push(iface.mac);
      }
    }
  }
  macs.sort();
  return createHash('sha256').update(macs.join(',')).digest('hex').substring(0, 32);
}
```

### Python
```python
import hashlib
import uuid

def get_hardware_id() -> str:
    mac = uuid.getnode()
    raw = f"{mac}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]
```

### Windows (PowerShell)
```powershell
$cpu = (Get-WmiObject Win32_Processor).ProcessorId
$board = (Get-WmiObject Win32_BaseBoard).SerialNumber
$raw = "$cpu-$board"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($raw)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$hwId = [System.BitConverter]::ToString($hash).Replace("-","").Substring(0,32).ToLower()
```

---

## 7. Erros e Troubleshooting

| Código / Razão | Causa | Solução |
|---|---|---|
| `valid: false, reason: "Token not found"` | Key inexistente ou digitada errada | Verificar a key com o administrador |
| `valid: false, reason: "Token is revoked"` | Token foi revogado manualmente | Contactar administrador para emitir novo token |
| `valid: false, reason: "Token has expired"` | Data de expiração passou | Renovar token no painel admin |
| `valid: false, reason: "Token usage limit reached"` | Limite de ativações atingido | Admin aumenta `maxUses` ou emite novo token |
| `valid: false, reason: "Token is bound to a different hardware"` | Hardware ID não bate | Verificar que `hardwareId` é consistente entre chamadas |
| `valid: false, reason: "Token does not belong to this application"` | `appId` incorreto | Verificar que `appId` corresponde ao produto cadastrado |
| `HTTP 429 Too Many Requests` | Rate limit atingido (30/min/IP) | Implementar back-off; usar cache local |
| `Network error: ...` | license-service inacessível | Usar verificação offline como fallback |

---

## 8. Segurança

### O que o sistema protege
- **Brute force**: rate limit de 30 req/min por IP no endpoint público
- **Timing attacks**: comparação em tempo constante (tanto no SDK quanto no backend) para hash SHA-256
- **Replay attacks**: cada verificação incrementa `usedCount` e é logada com IP e timestamp
- **Hardware piracy**: hardware binding impede uso do mesmo token em múltiplas máquinas

### Boas práticas para o cliente
1. **Não exponha a key em código-fonte** — ler de arquivo de configuração, variável de ambiente ou input do usuário
2. **Persista o hash SHA-256** localmente para verificação offline de emergência
3. **Use `hardwareId`** em aplicações desktop para prevenir compartilhamento
4. **Use `MemoryCache`** com TTL razoável (5-15 min) para reduzir latência e chamadas à API
5. **Trate `valid: false`** graciosamente — nunca quebre o app abruptamente sem mensagem clara

---

## 9. Fluxo completo de ativação (diagrama)

```
1. Usuário compra/recebe licença
   └─ Admin emite token via painel (/admin/developer/licencas)
      ├─ Bind cliente ao produto (POST /clients/:id/bind)
      └─ Gera token (POST /tokens) → retorna { key, hash }

2. Distribuição
   └─ Admin envia a key para o cliente (email, painel, etc.)
      └─ Cliente salva:
         ├─ key = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  (para verificação online)
         └─ hash = "4b5c..."                               (para verificação offline)

3. Ativação no primeiro uso
   └─ Aplicação chama POST /tokens/verify com { key, appId, hardwareId }
      └─ Se token não tinha hardwareId → fica vinculado ao hardware atual
         └─ Próximas verificações: hardwareId deve ser o mesmo

4. Verificações subsequentes
   ├─ Online (padrão): POST /tokens/verify → resultado fresco (revogação detectada)
   └─ Offline (fallback): verifyOffline(key, savedHash) → apenas autentica a key
```

---

## 10. Referência dos tipos

```typescript
interface LicenseVerificationResult {
  valid: boolean;
  reason?: string;          // presente quando valid=false
  clientId?: string;        // presente quando valid=true
  product?: {
    id: string;
    name: string;
    appId: string;
  };
  expiresAt?: string | null; // ISO 8601 ou null (sem expiração)
}

interface LicenseVerifyOptions {
  hardwareId?: string;   // fingerprint do hardware
  appVersion?: string;   // versão do app (gravada no audit log)
}

interface LicenseClientOptions {
  baseUrl: string;        // URL base da license-service API
  appId: string;          // appId do produto cadastrado
  timeout?: number;       // timeout em ms (padrão: 10000)
  retries?: number;       // tentativas em erro de rede (padrão: 2)
  retryDelayMs?: number;  // delay base do back-off em ms (padrão: 500)
  cache?: VerificationCache; // cache de resultados válidos
}
```
