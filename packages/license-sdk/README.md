# @szdevs/license-sdk

TypeScript SDK for verifying SZDevs license tokens.

## Installation

```bash
# within the SZDevs monorepo
pnpm add @szdevs/license-sdk
```

## Quick Start

```typescript
import { LicenseClient, MemoryCache } from '@szdevs/license-sdk';

const client = new LicenseClient({
  baseUrl: 'https://api.szdevs.com',
  appId: 'my-product',                         // matches the registered appId
  cache: new MemoryCache({ ttlSeconds: 300 }), // optional: cache valid results 5 min
});

const result = await client.verify(licenseKey, {
  hardwareId: 'AA:BB:CC:DD:EE:FF', // optional hardware binding
  appVersion: '1.2.3',             // optional, recorded in audit log
});

if (result.valid) {
  // grant access
} else {
  console.error(result.reason);
}
```

## Offline Verification

```typescript
import { verifyOffline } from '@szdevs/license-sdk';

// savedHash came from the token issuance response and was persisted locally
const isValid = verifyOffline(userKey, savedHash);
```

> Offline verification does NOT check revocation, expiry, or usage limits.
> Use only as a fallback when the license-service is unreachable.

## API

### `LicenseClient`

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | — | Base URL of the license-service |
| `appId` | `string` | — | Application identifier (must match product's appId) |
| `timeout` | `number` | `10000` | Request timeout in ms |
| `retries` | `number` | `2` | Extra retry attempts on network errors |
| `retryDelayMs` | `number` | `500` | Base delay for exponential back-off |
| `cache` | `VerificationCache` | none | Cache instance for valid results |

### `MemoryCache`

| Option | Type | Default | Description |
|---|---|---|---|
| `ttlSeconds` | `number` | `300` | How long to cache a valid result |
| `maxEntries` | `number` | `1000` | Max cache size before oldest is evicted |

### `verifyOffline(key, expectedHash)`

Returns `true` if SHA-256 hash of `key` matches `expectedHash`. Uses constant-time comparison.

### `hashKey(key)`

Returns the SHA-256 hex digest of a license key (same algorithm as the backend).

## Integration Guides

See [`/docs/license-sdk-integration.md`](../../docs/license-sdk-integration.md) for:
- Python integration
- Go integration
- cURL examples
- Hardware fingerprinting
- Security best practices
- Full activation flow diagram
