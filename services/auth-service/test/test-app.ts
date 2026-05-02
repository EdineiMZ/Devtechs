import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from '../src/app.module';

/**
 * Boot the real Nest app for an integration test. We do NOT mock
 * Prisma or Redis — the value of integration tests is exactly that
 * the wiring you ship is the wiring you test. Run them sequentially
 * (`maxWorkers: 1` in jest.int.config.cjs) against a dev DB.
 *
 * The pipe registration mirrors `main.ts` so DTO validation behaves
 * identically. If `main.ts` adds new global pipes/filters, mirror
 * them here or your tests start lying.
 */
export async function bootTestApp(): Promise<{
  app: INestApplication;
  module: TestingModule;
}> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  return { app, module };
}
