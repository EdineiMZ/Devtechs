import type { LicenseVerificationResult, LicenseVerifyOptions } from './types';
import type { VerificationCache } from './cache';

/** Configuration for the LicenseClient. */
export interface LicenseClientOptions {
  /** Base URL of the license-service API (e.g., "https://api.szdevs.com"). */
  baseUrl: string;
  /** Unique application identifier registered in the license-service. */
  appId: string;
  /** Request timeout in milliseconds (default: 10000). */
  timeout?: number;
  /** Number of retry attempts on network errors (default: 2, set 0 to disable). */
  retries?: number;
  /** Base delay in ms for exponential back-off between retries (default: 500). */
  retryDelayMs?: number;
  /**
   * Verification cache. Pass a MemoryCache instance to avoid re-hitting the
   * API for keys that were recently verified. Defaults to no caching.
   *
   * @example
   * ```ts
   * import { LicenseClient, MemoryCache } from '@szdevs/license-sdk';
   * const client = new LicenseClient({
   *   baseUrl: 'https://api.szdevs.com',
   *   appId: 'my-app',
   *   cache: new MemoryCache({ ttlSeconds: 300 }), // cache valid results for 5 min
   * });
   * ```
   */
  cache?: VerificationCache;
}

/**
 * Client for verifying SZDevs license tokens.
 *
 * Calls `POST /tokens/verify` on the license-service — this endpoint
 * is public (no auth required) so client applications can verify
 * license keys without exposing admin credentials.
 *
 * @example
 * ```ts
 * const client = new LicenseClient({
 *   baseUrl: 'https://api.szdevs.com',
 *   appId: 'my-saas-app',
 * });
 *
 * const result = await client.verify('key-uuid-here');
 * ```
 */
export class LicenseClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly retryDelayMs: number;
  private readonly cache: VerificationCache | null;

  constructor(options: LicenseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.appId = options.appId;
    this.timeout = options.timeout ?? 10_000;
    this.retries = options.retries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.cache = options.cache ?? null;
  }

  /**
   * Verify a license key against the license-service API.
   *
   * Retries on network errors with exponential back-off. If a cache was
   * provided, successful valid results are cached for the configured TTL so
   * subsequent calls don't hit the network.
   *
   * @param key - UUID v4 activation key
   * @param options - Optional hardware ID and app version
   * @returns Verification result with validity and metadata
   */
  async verify(
    key: string,
    options?: LicenseVerifyOptions,
  ): Promise<LicenseVerificationResult> {
    const cacheKey = `${key}:${options?.hardwareId ?? ''}`;

    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const result = await this.verifyWithRetry(key, options);

    if (this.cache && result.valid) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  private async verifyWithRetry(
    key: string,
    options?: LicenseVerifyOptions,
    attempt = 0,
  ): Promise<LicenseVerificationResult> {
    const url = `${this.baseUrl}/tokens/verify`;

    const body: Record<string, unknown> = {
      key,
      appId: this.appId,
    };
    if (options?.hardwareId) body['hardwareId'] = options.hardwareId;
    if (options?.appVersion) body['appVersion'] = options.appVersion;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return {
          valid: false,
          reason: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return (await response.json()) as LicenseVerificationResult;
    } catch (err) {
      if (attempt < this.retries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        return this.verifyWithRetry(key, options, attempt + 1);
      }
      const message = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        reason: `Network error: ${message}`,
      };
    }
  }
}
