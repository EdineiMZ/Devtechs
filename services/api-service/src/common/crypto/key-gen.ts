import { randomBytes } from 'node:crypto';

import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;
const BASE62_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Encode a Buffer of random bytes as a base62 string of exactly `length`
 * characters. We request more bytes than we need (2x) to avoid modulo
 * bias and slice to the desired length.
 */
function base62(length: number): string {
  const bytes = randomBytes(length * 2);
  let result = '';
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    const idx = byte % BASE62_CHARS.length;
    result += BASE62_CHARS[idx];
  }
  // Pad with extra bytes if we happened to not get enough (extremely rare).
  while (result.length < length) {
    const extra = randomBytes(8);
    for (let i = 0; i < extra.length && result.length < length; i++) {
      const byte = extra[i];
      if (byte === undefined) continue;
      result += BASE62_CHARS[byte % BASE62_CHARS.length];
    }
  }
  return result.slice(0, length);
}

export interface GeneratedApiKey {
  /** The full key string that should be shown to the user once. */
  fullKey: string;
  /** The prefix segment used for DB lookup: "szd_live_XXXXXXXX" */
  prefix: string;
  /** The 32-char secret used for bcrypt hashing. */
  secret: string;
}

/**
 * Generate a new API key with the format:
 *   szd_live_{8 alphanumeric chars}_{32 alphanumeric chars}
 *
 * The prefix ("szd_live_XXXXXXXX") is stored in DB for O(1) lookup.
 * The secret (32 chars) is hashed via bcrypt; only the hash is stored.
 */
export function generateApiKey(): GeneratedApiKey {
  const prefixId = base62(8);
  const secret = base62(32);
  const prefix = `szd_live_${prefixId}`;
  const fullKey = `${prefix}_${secret}`;
  return { fullKey, prefix, secret };
}

/**
 * Hash the 32-char secret portion of an API key using bcrypt.
 * Returns the hash string suitable for DB storage.
 */
export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext secret against a stored bcrypt hash.
 */
export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
