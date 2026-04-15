import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * devops-service bootstrap.
 *
 * Listens on `DEVOPS_SERVICE_PORT` (default 3005). Needs a
 * raw-body capture on the GitHub webhook route so the HMAC
 * verifier can recompute the signature over the exact bytes
 * GitHub sent. Express's `body-parser.json` exposes a `verify`
 * hook for this — we stash the Buffer on `req.rawBody` and then
 * let Nest parse the JSON normally.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    // Body parsing is handled manually so we can attach the raw
    // buffer to the request object on the webhook path.
    bodyParser: false,
  });

  // Raw-body capture — only for the GitHub webhook route to keep
  // the extra memory cost bounded. 1MB cap matches GitHub's own
  // max delivery size.
  app.use(
    '/devops/github/webhook',
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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Hub-Signature-256',
      'X-GitHub-Event',
    ],
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
    process.env.DEVOPS_SERVICE_PORT ?? process.env.PORT ?? 3005,
  );
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.info(`[devops-service] listening on port ${port}`);
}

void bootstrap();
