import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ChatIoAdapter } from './chat-io.adapter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * support-service bootstrap.
 *
 * Listens on `SUPPORT_SERVICE_PORT` (default 3006). HTTP serves
 * the REST endpoints; the same port is upgraded to a Socket.io
 * WebSocket server by the SupportGateway — one port, two
 * protocols. The gateway uses a Redis-backed adapter so room
 * broadcasts fan out across every support-service instance.
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

  // Install the Socket.io Redis adapter BEFORE .listen() so the
  // gateway's server instance already has the adapter attached
  // when it starts accepting upgrade requests.
  const ioAdapter = new ChatIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  const port = Number(
    process.env.SUPPORT_SERVICE_PORT ?? process.env.PORT ?? 3006,
  );
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[support-service] listening on port ${port}`);
}

void bootstrap();
