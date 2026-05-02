import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost,http://localhost:3000,http://localhost:3006'
  )
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

  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(
    process.env.LICENSE_SERVICE_PORT ?? process.env.PORT ?? 4007,
  );
  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: "license",
    title: "DevTechs — License Service API",
    description: "Licensed products, client bindings, activation tokens.",
    tags: [
      { name: "products" },
      { name: "bindings" },
      { name: "tokens" },
      { name: "activations" },
      { name: "health" },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info("[license-service] OpenAPI written to " + outPath);
    await app.close();
    return;
  }

  await app.listen(port, '0.0.0.0');
  console.info(`[license-service] listening on port ${port} (Swagger: /license/docs)`);
}

void bootstrap();
