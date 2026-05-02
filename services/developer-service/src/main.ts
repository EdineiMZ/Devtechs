import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { setupSwagger } from "./swagger";
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
if (isDev) {
  process.on('uncaughtException', (err: Error) => {
    const msg = err?.message ?? '';
    if (
      msg.includes('ETIMEDOUT') ||
      msg.includes('Connection is closed') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('MaxRetriesPerRequest')
    ) {
      console.warn(`[dev-tolerance] swallowed Redis error: ${msg}`);
      return;
    }
    throw err;
  });
  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (
      msg.includes('ETIMEDOUT') ||
      msg.includes('Connection is closed') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('MaxRetriesPerRequest')
    ) {
      console.warn(`[dev-tolerance] swallowed Redis rejection: ${msg}`);
      return;
    }
    throw reason;
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    'http://localhost,http://localhost:3000,http://localhost:3007'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.getHttpAdapter().getInstance().disable('x-powered-by');

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

  const port = Number(
    process.env.DEVELOPER_SERVICE_PORT ?? process.env.PORT ?? 4010,
  );
  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: "developer",
    title: "DevTechs — Developer Service API",
    description: "Internal ops console: docker services, queues, logs, config, VPS.",
    tags: [
      { name: "services" },
      { name: "queues" },
      { name: "logs" },
      { name: "config" },
      { name: "vps" },
      { name: "health" },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info("[developer-service] OpenAPI written to " + outPath);
    await app.close();
    return;
  }

  await app.listen(port, '0.0.0.0');
  console.info(`[developer-service] listening on port ${port} (Swagger: /developer/docs)`);
}

void bootstrap();
