import { createHash } from 'crypto';

/**
 * Compute the SHA-256 hex digest of a license key.
 *
 * This is the same algorithm the license-service uses when generating
 * tokens. You can compare this hash against a pre-distributed hash
 * to verify a key without calling the API.
 *
 * @param key - The UUID v4 license key
 * @returns 64-character lowercase hex string
 *
 * @example
 * ```ts
 * import { hashKey } from '@szdevs/license-sdk';
 *
 * const hash = hashKey('550e8400-e29b-41d4-a716-446655440000');
 * // -> 'a1b2c3d4...' (64 hex chars)
 * ```
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * Verify a license key offline by comparing its SHA-256 hash
 * against a known-good hash.
 *
 * Use this when the application cannot reach the license-service
 * (e.g., air-gapped environments). Note that offline verification
 * cannot check usage limits, expiration, or revocation status --
 * it only confirms the key itself is authentic.
 *
 * @param key - The UUID v4 license key provided by the user
 * @param expectedHash - The SHA-256 hash from the token issuance response
 * @returns true if the key matches the expected hash
 *
 * @example
 * ```ts
 * import { verifyOffline } from '@szdevs/license-sdk';
 *
 * // expectedHash was saved during initial activation
 * const valid = verifyOffline(userKey, savedHash);
 * if (!valid) {
 *   console.error('Invalid license key');
 * }
 * ```
 */
export function verifyOffline(key: string, expectedHash: string): boolean {
  const computed = hashKey(key);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== expectedHash.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return result === 0;
}
