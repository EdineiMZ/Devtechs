import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
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

/**
 * notification-service bootstrap.
 *
 * Listens on `NOTIFICATION_SERVICE_PORT` (default 3006). The HTTP
 * listener serves REST endpoints (GET /notifications etc.) and the
 * same port is upgraded to a socket.io WebSocket server by the
 * NotificationGateway — one port, two protocols.
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

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(
    process.env.NOTIFICATION_SERVICE_PORT ?? process.env.PORT ?? 3006,
  );
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[notification-service] listening on port ${port}`);
}

void bootstrap();
