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
  // Global prefix: all public routes are under /v1
  // Excluded: /health (liveness probe) and /internal/* (admin routes)
  // -----------------------------------------------------------------------
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'internal/(.*)'],
  });

  // -----------------------------------------------------------------------
  // CORS — allow the Next.js apps behind nginx and local dev tooling
  // -----------------------------------------------------------------------
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost,http://localhost:4000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Authorization', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
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
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  //
  // Always enabled for the public API service — it IS the public docs.
  // The DISABLE_SWAGGER=true env var can turn it off if explicitly needed.
  //
  // Extract-only mode: when OPENAPI_EXTRACT_TO is set, dump the generated
  // document to that path and exit before the HTTP listener binds.
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: 'api',
    title: 'SZDevs — Public API',
    description:
      'Public REST API for szdevs.com integrations. Authenticate with an API key ' +
      '(`Authorization: Bearer szd_live_...`). Admin key management routes use JWT ' +
      '(`Authorization: Bearer <jwt>`) and require the `integrations:manage` permission.',
    tags: [
      { name: 'me', description: 'Current API key information' },
      { name: 'tickets', description: 'Support ticket operations' },
      { name: 'projects', description: 'Project and task operations' },
      { name: 'finance', description: 'Invoices and subscriptions' },
      { name: 'admin-api-keys', description: 'API key lifecycle management (admin only)' },
      { name: 'health', description: 'Liveness probe' },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info(`[api-service] OpenAPI written to ${outPath}`);
    await app.close();
    return;
  }

  // -----------------------------------------------------------------------
  // Listen
  // -----------------------------------------------------------------------
  const port = Number(process.env.API_SERVICE_PORT ?? process.env.PORT ?? 3011);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[api-service] listening on port ${port} (Swagger: /docs)`);
}

void bootstrap();
