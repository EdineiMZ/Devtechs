import type { LicenseVerificationResult, LicenseVerifyOptions } from './types';

/** Configuration for the LicenseClient. */
export interface LicenseClientOptions {
  /** Base URL of the license-service API (e.g., "https://api.szdevs.com"). */
  baseUrl: string;
  /** Unique application identifier registered in the license-service. */
  appId: string;
  /** Request timeout in milliseconds (default: 10000). */
  timeout?: number;
}

/**
 * Client for verifying SZDevs license tokens.
 *
 * Calls `POST /tokens/verify` on the license-service â€” this endpoint
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

  constructor(options: LicenseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.appId = options.appId;
    this.timeout = options.timeout ?? 10_000;
  }

  /**
   * Verify a license key against the license-service API.
   *
   * @param key - UUID v4 activation key
   * @param options - Optional hardware ID and app version
   * @returns Verification result with validity and metadata
   */
  async verify(
    key: string,
    options?: LicenseVerifyOptions,
  ): Promise<LicenseVerificationResult> {
    const url = `${this.baseUrl}/tokens/verify`;

    const body = {
      key,
      appId: this.appId,
      hardwareId: options?.hardwareId,
    };

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
      const message = err instanceof Error ? err.message : String(err);
      return {
        valid: false,
        reason: `Network error: ${message}`,
      };
    }
  }
}
