import { createHmac, timingSafeEqual } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

import type {
  LocalAdapterConfig,
  StorageAdapter,
  UploadResult,
} from './types';

/**
 * Filesystem-backed adapter for local development and tests.
 *
 * Files land in `basePath/<key>`. The public URL is
 * `publicBaseUrl/<key>`, where `publicBaseUrl` is served by the
 * consuming NestJS app via `ServeStaticModule` (or equivalent).
 *
 * Security notes:
 * - `resolveSafe()` rejects any key whose canonical path escapes the
 *   configured `basePath`, so `"../etc/passwd"` and friends are
 *   refused before hitting `readFile`.
 * - `getSignedUrl()` returns a URL signed with an HMAC of
 *   `key|expiresAt|secret`. The consuming app's static-serve layer can
 *   verify the signature before handing back the file if it wants
 *   authenticated access; the default `publicBaseUrl` is open-read,
 *   which is fine for dev.
 */
export class LocalAdapter implements StorageAdapter {
  private readonly basePath: string;
  private readonly publicBaseUrl: string;
  private readonly signingSecret: string;

  constructor(config: LocalAdapterConfig) {
    if (!config.basePath || !config.publicBaseUrl) {
      throw new Error('LocalAdapter: basePath and publicBaseUrl are required');
    }
    this.basePath = resolve(config.basePath);
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, '');
    this.signingSecret = config.signingSecret ?? 'devtechs-local-dev';
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<UploadResult> {
    const abs = this.resolveSafe(key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buffer);
    return { key, url: `${this.publicBaseUrl}/${encodeKeyForUrl(key)}` };
  }

  async download(key: string): Promise<Buffer> {
    const abs = this.resolveSafe(key);
    return readFile(abs);
  }

  async delete(key: string): Promise<void> {
    const abs = this.resolveSafe(key);
    try {
      await unlink(abs);
    } catch (err) {
      // Idempotent: treat ENOENT as success.
      if (isNodeErr(err) && err.code === 'ENOENT') return;
      throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    // Assert the key is safe before returning a URL for it.
    this.resolveSafe(key);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = this.sign(key, expiresAt);
    const url = new URL(`${this.publicBaseUrl}/${encodeKeyForUrl(key)}`);
    url.searchParams.set('expires', String(expiresAt));
    url.searchParams.set('sig', signature);
    return url.toString();
  }

  async exists(key: string): Promise<boolean> {
    const abs = this.resolveSafe(key);
    try {
      await access(abs, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------
  // Signed-URL verification helper (exposed so the NestJS app can call
  // it from its static-serve middleware if it wants authenticated
  // access in dev). Kept on the adapter because the secret lives here.
  // -------------------------------------------------------------------

  verifySignature(key: string, expiresAt: number, signature: string): boolean {
    if (Number.isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expected = this.sign(key, expiresAt);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  // -------------------------------------------------------------------
  // Privates
  // -------------------------------------------------------------------

  private sign(key: string, expiresAt: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${key}|${expiresAt}`)
      .digest('hex');
  }

  /**
   * Resolve `key` against `basePath` and refuse to leave the sandbox.
   *
   * We use `path.relative()` instead of `startsWith` because the
   * latter has subtle cross-platform bugs (`/foo/bar` vs `/foo/bar2`,
   * Windows `\\` separators, etc.). `relative()` normalizes both
   * paths the same way; if the result starts with `..` or is
   * absolute, the key escapes.
   */
  private resolveSafe(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('LocalAdapter: key must be a non-empty string');
    }
    // Strip leading separators so `normalize('/foo')` doesn't turn
    // into an absolute path on POSIX.
    const stripped = normalize(key).replace(/^[/\\]+/, '');
    const abs = resolve(join(this.basePath, stripped));
    const rel = relative(this.basePath, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`LocalAdapter: key "${key}" escapes the base path`);
    }
    return abs;
  }
}

function encodeKeyForUrl(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function isNodeErr(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === 'object' && err !== null && 'code' in err;
}
