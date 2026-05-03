/**
 * @szdevs/license-sdk
 *
 * TypeScript SDK for verifying SZDevs license tokens.
 * Used by client applications to validate activation keys
 * against the license-service API.
 *
 * @example
 * ```ts
 * import { LicenseClient } from '@szdevs/license-sdk';
 *
 * const client = new LicenseClient({
 *   baseUrl: 'https://api.szdevs.com',
 *   appId: 'my-saas-app',
 * });
 *
 * const result = await client.verify('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
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
