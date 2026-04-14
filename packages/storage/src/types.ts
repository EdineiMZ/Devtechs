/**
 * Result of a successful upload. `key` is the canonical identifier
 * used by all other adapter methods, `url` is a ready-to-serve URL
 * (public for CDN-backed buckets, localhost for the local adapter).
 */
export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Uniform storage adapter interface. Implementations must be fully
 * isomorphic from the caller's perspective — switching from
 * `LocalAdapter` to `R2Adapter` should require only an env change,
 * never a code change in consuming services.
 *
 * Key ergonomics:
 * - `key` is always a relative path-like string; it must NOT be URL-encoded.
 * - `upload` returns a `url` only as a convenience (for LocalAdapter this
 *   is a served path, for R2Adapter it's the public CDN URL). Callers
 *   that need short-lived, authenticated access should call
 *   `getSignedUrl` instead.
 * - `download` returns the raw bytes; callers are responsible for
 *   streaming semantics if they need them.
 * - `delete` is idempotent: removing a non-existent key is a no-op,
 *   not an error.
 */
export interface StorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

/**
 * Discriminator for `StorageFactory`. Keep this in sync with the
 * `STORAGE_PROVIDER` environment variable consumed by the factory.
 */
export type StorageProvider = 'r2' | 'local';

export interface R2AdapterConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Optional CDN / public base URL served by Cloudflare in front of the bucket. */
  publicUrl?: string;
  /** R2 is region-less but the SDK still needs a placeholder — defaults to `auto`. */
  region?: string;
}

export interface LocalAdapterConfig {
  /** Absolute or project-relative directory where files are persisted. */
  basePath: string;
  /** Base URL at which `basePath` is served (e.g. `http://localhost:3001/uploads`). */
  publicBaseUrl: string;
  /**
   * Secret used to sign local-only "signed URLs". Short random string is fine;
   * it only has to be stable across requests of the same process.
   */
  signingSecret?: string;
}
