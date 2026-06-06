/**
 * @szdevs/license-sdk
 *
 * TypeScript SDK for verifying SZDevs license tokens.
 * Used by client applications to validate activation keys
 * against the license-service API.
 *
 * @example
 * ```ts
 * import { LicenseClient, MemoryCache } from '@szdevs/license-sdk';
 *
 * const client = new LicenseClient({
 *   baseUrl: 'https://api.szdevs.com',
 *   appId: 'my-saas-app',
 *   cache: new MemoryCache({ ttlSeconds: 300 }),
 * });
 *
 * const result = await client.verify('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', {
 *   hardwareId: 'AA:BB:CC:DD:EE:FF',
 *   appVersion: '1.2.3',
 * });
 * if (result.valid) {
 *   console.log('License valid for client:', result.clientId);
 * } else {
 *   console.error('License invalid:', result.reason);
 * }
 * ```
 */

export { LicenseClient, type LicenseClientOptions } from './client';
export {
  type LicenseVerificationResult,
  type LicenseVerifyOptions,
  type LicenseProductInfo,
} from './types';
export { hashKey, verifyOffline } from './offline';
export { MemoryCache, type VerificationCache, type MemoryCacheOptions } from './cache';
