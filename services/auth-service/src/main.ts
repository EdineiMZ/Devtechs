import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // -----------------------------------------------------------------------
  // CORS - allow the Next.js apps behind nginx and local dev tooling
  // -----------------------------------------------------------------------
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost,http://localhost:4000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
  });

  // -----------------------------------------------------------------------
  // Global pipes: validate & transform all incoming DTOs
  // -----------------------------------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  // -----------------------------------------------------------------------
  // Global filter & interceptor
  // -----------------------------------------------------------------------
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  //
  // Mounted at `/auth/docs` and `/docs`. Disabled in production unless
  // `EXPOSE_SWAGGER_IN_PROD=true` so internal API shape doesn't leak.
  //
  // Extract-only mode: when `OPENAPI_EXTRACT_TO` is set, dump the
  // generated document to that path and exit BEFORE the HTTP listener
  // binds. Used by `pnpm docs:generate` to build the unified spec
  // without spinning up real ports.
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: 'auth',
    title: 'SZDevs â€” Auth Service API',
    description:
      'Authentication, authorization, sessions, 2FA, OAuth account linking, ' +
      'audit log query surface, and admin session management.',
    tags: [
      { name: 'auth', description: 'Sign-up, sign-in, token refresh, email verification' },
      { name: '2fa', description: 'Two-factor authentication setup and challenge' },
      { name: 'oauth', description: 'Provider-driven sign-in (Google, GitHub)' },
      { name: 'roles', description: 'Role CRUD and assignment' },
      { name: 'permissions', description: 'Direct permission grants and lookups' },
      { name: 'audit', description: 'Audit log query, stats, exports, security report' },
      { name: 'admin-sessions', description: "Inspect/revoke another user's sessions" },
      { name: 'health', description: 'Liveness probe' },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info(`[auth-service] OpenAPI written to ${outPath}`);
    await app.close();
    return;
  }

  // -----------------------------------------------------------------------
  // Listen
  // -----------------------------------------------------------------------
  const port = Number(process.env.AUTH_SERVICE_PORT ?? process.env.PORT ?? 4001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[auth-service] listening on port ${port} (Swagger: /auth/docs)`);
}

void bootstrap();
