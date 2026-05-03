import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StorageFactory, type StorageEnv } from './factory';

/**
 * Injection token for the active `StorageAdapter`. Use `@Inject(STORAGE)`
 * in services that need raw access to the adapter interface, or (more
 * commonly) inject the adapter by interface in a constructor field
 * typed as `StorageAdapter` â€” the token resolves the same instance
 * either way.
 *
 *   constructor(@Inject(STORAGE) private readonly storage: StorageAdapter) {}
 */
export const STORAGE = Symbol.for('@szdevs/storage:STORAGE');

/**
 * `StorageModule.forRoot()` wires a singleton `StorageAdapter` built
 * from environment variables. The module is marked `@Global()` so a
 * single `forRoot()` in `AppModule` makes the adapter injectable
 * everywhere without ceremonial re-imports in every feature module.
 *
 *   @Module({
 *     imports: [
 *       ConfigModule.forRoot({ isGlobal: true }),
 *       StorageModule.forRoot(),
 *     ],
 *   })
 *   export class AppModule {}
 *
 * If you need to override the env lookup (e.g. in tests) you can pass
 * a literal env object:
 *
 *   StorageModule.forRoot({ env: { STORAGE_PROVIDER: 'local', ... } })
 */
export interface StorageModuleOptions {
  /** Explicit env record. Defaults to reading from `ConfigService`. */
  env?: StorageEnv;
}

@Global()
@Module({})
export class StorageModule {
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const provider: Provider = {
      provide: STORAGE,
      inject: options.env ? [] : [ConfigService],
      useFactory: (config?: ConfigService) => {
        const env: StorageEnv = options.env ?? {
          STORAGE_PROVIDER: config?.get<string>('STORAGE_PROVIDER'),
          CLOUDFLARE_R2_ENDPOINT: config?.get<string>('CLOUDFLARE_R2_ENDPOINT'),
          CLOUDFLARE_R2_ACCESS_KEY_ID: config?.get<string>('CLOUDFLARE_R2_ACCESS_KEY_ID'),
          CLOUDFLARE_R2_SECRET_ACCESS_KEY: config?.get<string>('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
          CLOUDFLARE_R2_BUCKET: config?.get<string>('CLOUDFLARE_R2_BUCKET'),
          CLOUDFLARE_R2_PUBLIC_URL: config?.get<string>('CLOUDFLARE_R2_PUBLIC_URL'),
          CLOUDFLARE_R2_REGION: config?.get<string>('CLOUDFLARE_R2_REGION'),
          LOCAL_STORAGE_PATH: config?.get<string>('LOCAL_STORAGE_PATH'),
          LOCAL_STORAGE_PUBLIC_URL: config?.get<string>('LOCAL_STORAGE_PUBLIC_URL'),
          LOCAL_STORAGE_SIGNING_SECRET: config?.get<string>('LOCAL_STORAGE_SIGNING_SECRET'),
        };
        return StorageFactory.fromEnv(env);
      },
    };

    return {
      module: StorageModule,
      providers: [provider],
      exports: [provider],
    };
  }
}
