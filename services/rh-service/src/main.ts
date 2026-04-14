import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * rh-service bootstrap.
 *
 * - Listens on `RH_SERVICE_PORT` (default 3002) matching `.env.example`.
 * - CORS opens to the Next.js frontends listed in `CORS_ORIGINS`, so the
 *   admin UIs in `apps/rh` and `apps/web` can hit this service directly
 *   during dev. In production nginx fronts everything and rewrites the
 *   Origin header, so this is mostly a dev convenience.
 * - Global ValidationPipe with `whitelist` + `transform` so every
 *   class-validator DTO is applied without per-controller boilerplate.
 * - Global `AllExceptionsFilter` normalizes every error response body
 *   into the same shape the auth-service emits, so the frontend can
 *   branch on `error`/`statusCode` identically for all services.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost,http://localhost:3000,http://localhost:4001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.RH_SERVICE_PORT ?? process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[rh-service] listening on port ${port}`);
}

void bootstrap();
