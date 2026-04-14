import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  R2AdapterConfig,
  StorageAdapter,
  UploadResult,
} from './types';

/**
 * Cloudflare R2 adapter.
 *
 * R2 is S3-API-compatible, so we use the standard AWS SDK with three
 * R2-specific tweaks:
 *
 * 1. `region: 'auto'` — R2 is region-less but the SDK panics without
 *    a region string; `auto` is the value Cloudflare recommends.
 * 2. `forcePathStyle: true` — R2 doesn't route virtual-host subdomains
 *    the way S3 does; path-style is the supported form.
 * 3. `endpoint` is always a full Cloudflare URL, not the AWS default.
 *
 * Public URLs come from a separately configured CDN origin
 * (`CLOUDFLARE_R2_PUBLIC_URL`) because the bucket endpoint is NOT
 * publicly fetchable by default — it requires signed requests.
 */
export class R2Adapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string | undefined;

  constructor(config: R2AdapterConfig) {
    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
      throw new Error(
        'R2Adapter: endpoint, accessKeyId, secretAccessKey, and bucket are all required',
      );
    }
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl?.replace(/\/+$/, '');
    this.client = new S3Client({
      region: config.region ?? 'auto',
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
      }),
    );
    return { key, url: this.toPublicUrl(key) };
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) {
      throw new Error(`R2Adapter: empty body for key "${key}"`);
    }
    // `Body` is a `ReadableStream | Readable | Blob` depending on runtime.
    // The SDK provides `transformToByteArray()` in v3 to normalize.
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    // Idempotent: R2 returns 204 for both "deleted" and "didn't exist".
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err) {
      // R2 returns NotFound (404) or NoSuchKey for missing keys; both
      // are expected and should not bubble up.
      if (isMissingKeyError(err)) return false;
      throw err;
    }
  }

  /**
   * Build a public CDN URL for the key. If no `publicUrl` is
   * configured we still return a URL pointing at the bucket endpoint
   * so callers have something to render, but access will require a
   * signed URL for any bucket that isn't public-read.
   */
  private toPublicUrl(key: string): string {
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    if (this.publicUrl) return `${this.publicUrl}/${encoded}`;
    return encoded;
  }
}

/**
 * Narrow inspection of S3 client errors. The AWS SDK doesn't export a
 * stable type for the thrown error, so we duck-type on the shape it
 * actually produces.
 */
function isMissingKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === 'NotFound' ||
    e.name === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}
