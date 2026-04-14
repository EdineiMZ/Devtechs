import { resolve } from 'node:path';

import { LocalAdapter } from './local.adapter';
import { R2Adapter } from './r2.adapter';
import type { StorageAdapter, StorageProvider } from './types';

/**
 * Shape of the environment variables consumed by `fromEnv`. Declared
 * here so consumers can reuse the same type when validating their own
 * ConfigService, and so the factory stays independent of `process.env`
 * (helpful for tests that stub it).
 */
export interface StorageEnv {
  STORAGE_PROVIDER?: string;

  // R2
  CLOUDFLARE_R2_ENDPOINT?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_BUCKET?: string;
  CLOUDFLARE_R2_PUBLIC_URL?: string;
  CLOUDFLARE_R2_REGION?: string;

  // Local
  LOCAL_STORAGE_PATH?: string;
  LOCAL_STORAGE_PUBLIC_URL?: string;
  LOCAL_STORAGE_SIGNING_SECRET?: string;
}

export class StorageFactory {
  /**
   * Build the right adapter for the given provider + env. Throws
   * early on missing configuration so a misdeployed service fails at
   * boot, not on the first upload request in production.
   */
  static create(provider: StorageProvider, env: StorageEnv): StorageAdapter {
    switch (provider) {
      case 'r2':
        return new R2Adapter({
          endpoint: required(env, 'CLOUDFLARE_R2_ENDPOINT'),
          accessKeyId: required(env, 'CLOUDFLARE_R2_ACCESS_KEY_ID'),
          secretAccessKey: required(env, 'CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
          bucket: required(env, 'CLOUDFLARE_R2_BUCKET'),
          publicUrl: env.CLOUDFLARE_R2_PUBLIC_URL,
          region: env.CLOUDFLARE_R2_REGION ?? 'auto',
        });

      case 'local': {
        const basePath = env.LOCAL_STORAGE_PATH ?? './uploads';
        const publicBaseUrl =
          env.LOCAL_STORAGE_PUBLIC_URL ?? 'http://localhost:3000/uploads';
        return new LocalAdapter({
          basePath: resolve(basePath),
          publicBaseUrl,
          signingSecret: env.LOCAL_STORAGE_SIGNING_SECRET,
        });
      }

      default: {
        // Exhaustiveness check: TypeScript will error here if
        // StorageProvider ever grows a new variant that isn't handled.
        const _exhaustive: never = provider;
        throw new Error(`Unknown STORAGE_PROVIDER: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Convenience wrapper that reads `STORAGE_PROVIDER` out of the
   * supplied env record and dispatches. Defaults to `local` if unset.
   */
  static fromEnv(env: StorageEnv = process.env as StorageEnv): StorageAdapter {
    const raw = (env.STORAGE_PROVIDER ?? 'local').toLowerCase();
    if (raw !== 'r2' && raw !== 'local') {
      throw new Error(
        `Invalid STORAGE_PROVIDER: "${raw}". Expected "r2" or "local".`,
      );
    }
    return StorageFactory.create(raw, env);
  }
}

function required(env: StorageEnv, key: keyof StorageEnv): string {
  const value = env[key];
  if (!value) {
    throw new Error(`StorageFactory: missing required env var "${key}"`);
  }
  return value;
}
