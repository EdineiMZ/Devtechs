import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Swagger / OpenAPI bootstrap for the public API service.
 *
 * Unlike internal services, Swagger is always enabled for the public API
 * service — it IS the public documentation. The EXPOSE_SWAGGER_IN_PROD flag
 * is still honored for backward compat, but the default here is always-on.
 *
 * The UI is mounted at `/docs` and the JSON spec at `/docs-json`.
 * Behind nginx the unified path is `/api/api/docs`.
 */

export interface SwaggerConfig {
  service: string;
  title: string;
  description: string;
  tags?: ReadonlyArray<{ name: string; description?: string }>;
  version?: string;
}

export function setupSwagger(
  app: INestApplication,
  config: SwaggerConfig,
): OpenAPIObject | null {
  const isProd = process.env.NODE_ENV === 'production';
  const force = process.env.EXPOSE_SWAGGER_IN_PROD === 'true';
  // For the public API service, Swagger is always on unless explicitly disabled.
  if (isProd && !force && process.env.DISABLE_SWAGGER === 'true') return null;

  const builder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version ?? process.env.npm_package_version ?? '0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description:
          'API key in the format `szd_live_XXXXXXXX_YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY`. ' +
          'Issued via the admin panel at `POST /internal/api-keys`.',
        name: 'API Key',
      },
      'api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT issued by the auth-service. Required for `/internal/api-keys/*` admin routes.',
        name: 'JWT (admin)',
      },
      'jwt-admin',
    )
    .addServer(`http://localhost:${process.env.API_SERVICE_PORT ?? '3011'}`, 'Local dev')
    .addServer('https://api.szdevs.com', 'Production');

  for (const tag of config.tags ?? []) {
    builder.addTag(tag.name, tag.description);
  }

  const document = SwaggerModule.createDocument(app, builder.build());

  // Mount under `/{service}/docs` and also at `/docs` for direct access.
  SwaggerModule.setup(`${config.service}/docs`, app, document, {
    customSiteTitle: `${config.title} – Swagger`,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${config.title} – Swagger`,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  return document;
}
