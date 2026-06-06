import type { LicenseVerificationResult } from './types';

/** Interface for a verification result cache. */
export interface VerificationCache {
  get(key: string): LicenseVerificationResult | null;
  set(key: string, value: LicenseVerificationResult): void;
  delete(key: string): void;
  clear(): void;
}

export interface MemoryCacheOptions {
  /** How long to cache a valid verification result in seconds (default: 300). */
  ttlSeconds?: number;
  /** Maximum number of entries before oldest are evicted (default: 1000). */
  maxEntries?: number;
}

interface CacheEntry {
  value: LicenseVerificationResult;
  expiresAt: number;
}

/**
 * Simple in-memory LRU-ish cache for verification results.
 *
 * Only valid (valid=true) results should be cached — the caller (LicenseClient)
 * handles this. Invalid results are not cached so revocations and expiry checks
 * are always re-evaluated.
 *
 * @example
 * ```ts
 * const client = new LicenseClient({
 *   baseUrl: 'https://api.szdevs.com',
 *   appId: 'my-app',
 *   cache: new MemoryCache({ ttlSeconds: 300 }),
 * });
 * ```
 */
export class MemoryCache implements VerificationCache {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, CacheEntry>();

  constructor(options: MemoryCacheOptions = {}) {
    this.ttlMs = (options.ttlSeconds ?? 300) * 1000;
    this.maxEntries = options.maxEntries ?? 1000;
  }

  get(key: string): LicenseVerificationResult | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: LicenseVerificationResult): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Number of non-expired entries currently in the cache. */
  get size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}
