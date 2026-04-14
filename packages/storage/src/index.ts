/**
 * @devtechs/storage — adapter-pattern storage layer.
 *
 * Public surface:
 *
 *   - `StorageAdapter` — the interface every adapter implements.
 *   - `R2Adapter` — Cloudflare R2 (S3-compatible) implementation.
 *   - `LocalAdapter` — filesystem implementation for dev / tests.
 *   - `StorageFactory` — picks the right adapter from env vars.
 *   - `StorageModule` + `STORAGE` — NestJS dynamic module + injection token.
 *   - `generateKey(folder, filename)` — canonical key builder.
 *
 * Typical NestJS wiring:
 *
 *   @Module({
 *     imports: [
 *       ConfigModule.forRoot({ isGlobal: true }),
 *       StorageModule.forRoot(),
 *     ],
 *   })
 *   export class AppModule {}
 *
 * Typical consumer:
 *
 *   import { Inject, Injectable } from '@nestjs/common';
 *   import { STORAGE, generateKey, type StorageAdapter } from '@devtechs/storage';
 *
 *   @Injectable()
 *   export class AvatarService {
 *     constructor(@Inject(STORAGE) private readonly storage: StorageAdapter) {}
 *
 *     async uploadAvatar(userId: string, file: Express.Multer.File) {
 *       const key = generateKey(`avatars/${userId}`, file.originalname);
 *       return this.storage.upload(key, file.buffer, file.mimetype);
 *     }
 *   }
 */

export type {
  StorageAdapter,
  StorageProvider,
  UploadResult,
  R2AdapterConfig,
  LocalAdapterConfig,
} from './types';

export { R2Adapter } from './r2.adapter';
export { LocalAdapter } from './local.adapter';
export { StorageFactory, type StorageEnv } from './factory';
export { generateKey } from './generate-key';
export {
  STORAGE,
  StorageModule,
  type StorageModuleOptions,
} from './storage.module';
