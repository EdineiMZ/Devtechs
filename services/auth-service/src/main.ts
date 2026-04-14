import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

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
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // -----------------------------------------------------------------------
  // Listen
  // -----------------------------------------------------------------------
  const port = Number(process.env.AUTH_SERVICE_PORT ?? process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[auth-service] listening on port ${port}`);
}

void bootstrap();
