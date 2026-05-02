import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { setupSwagger } from "./swagger";
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * projects-service bootstrap.
 *
 * Listens on `PROJECTS_SERVICE_PORT` (default 3004) matching
 * `.env.example`. Same shape as auth-service / rh-service: global
 * ValidationPipe, global exception filter, CORS for the Next.js
 * frontends. Trusts JWTs signed by auth-service for identity and
 * resolves authorization via HTTP through the auth-client.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost,http://localhost:3000,http://localhost:4003'
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
    process.env.PROJECTS_SERVICE_PORT ?? process.env.PORT ?? 3004,
  );
  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: "projects",
    title: "DevTechs — Projects Service API",
    description: "Projects, tasks, sprints, time tracking.",
    tags: [
      { name: "projects" },
      { name: "tasks" },
      { name: "sprints" },
      { name: "time-tracking" },
      { name: "health" },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info("[projects-service] OpenAPI written to " + outPath);
    await app.close();
    return;
  }

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[projects-service] listening on port ${port}`);
}

void bootstrap();
