import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { setupSwagger } from './swagger';

/**
 * payments-service bootstrap.
 *
 * Listens on `PAYMENTS_SERVICE_PORT` (default 3007). Raw body is
 * captured on the Mercado Pago webhook route so the HMAC verifier
 * can recompute the signature over the exact bytes received.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    // Body parsing is handled manually to attach the raw buffer on
    // the webhook path.
    bodyParser: false,
  });

  // Raw-body capture — only for the Mercado Pago webhook route.
  app.use(
    '/webhooks/mercadopago',
    json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  // Normal JSON parsing for every other route.
  app.use(json({ limit: '1mb' }));

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

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(
    process.env.PAYMENTS_SERVICE_PORT ?? process.env.PORT ?? 3007,
  );
  // -----------------------------------------------------------------------
  // Swagger / OpenAPI
  // -----------------------------------------------------------------------
  const document = setupSwagger(app, {
    service: "payments",
    title: "DevTechs — Payments Service API",
    description: "Subscriptions, payments, plans, coupons, MP webhooks.",
    tags: [
      { name: "subscriptions" },
      { name: "payments" },
      { name: "plans" },
      { name: "coupons" },
      { name: "webhooks" },
      { name: "health" },
    ],
  });

  if (process.env.OPENAPI_EXTRACT_TO && document) {
    const outPath = process.env.OPENAPI_EXTRACT_TO;
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(document, null, 2));
    // eslint-disable-next-line no-console
    console.info("[payments-service] OpenAPI written to " + outPath);
    await app.close();
    return;
  }

  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[payments-service] listening on port ${port} (Swagger: /payments/docs)`);
}

void bootstrap();
