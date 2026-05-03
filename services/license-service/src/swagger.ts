import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Swagger / OpenAPI bootstrap shared by every NestJS service.
 *
 * Why a per-service helper file (instead of a workspace package):
 * NestJS services compile their own TypeScript independently and don't
 * share a single `transpilePackages` boundary, so a workspace
 * `@szdevs/swagger` would need its own `tsc` step + dist publish to
 * be consumable. A 30-line helper inlined in each service is cheaper
 * to maintain and lets each service tune its own tag set.
 *
 * Production safety:
 *   - Disabled outright when NODE_ENV === 'production' UNLESS
 *     `EXPOSE_SWAGGER_IN_PROD=true` is set explicitly. This keeps
 *     internal API shape from leaking from staging/prod into the
 *     wider internet.
 *   - The `/docs-json` JSON endpoint is gated by the same flag â€” it
 *     leaks just as much as the HTML.
 *
 * Path convention:
 *   Each service mounts the UI under `/{service}/docs` and the JSON
 *   under `/{service}/docs-json`. Behind nginx, the unified path is
 *   `/api/{service}/docs`, which Redoc on `/docs` consumes via the
 *   merged spec in `/docs/openapi.unified.json`.
 */

export interface SwaggerConfig {
  /** Slug used in URLs and unified-merge keys. e.g. `auth`. */
  service: string;
  /** Human title rendered at the top of the Swagger UI page. */
  title: string;
  /** Long description displayed under the title. */
  description: string;
  /** Tag list â€” first entry is the default tag for untagged routes. */
  tags?: ReadonlyArray<{ name: string; description?: string }>;
  /** Override version; defaults to `process.env.npm_package_version`. */
  version?: string;
}

/**
 * Builds the OpenAPI document and mounts the UI on the given app.
 * Returns the document so callers can dump it to disk in extract mode
 * (see `scripts/openapi/extract.mjs`).
 */
export function setupSwagger(
  app: INestApplication,
  config: SwaggerConfig,
): OpenAPIObject | null {
  const isProd = process.env.NODE_ENV === 'production';
  const force = process.env.EXPOSE_SWAGGER_IN_PROD === 'true';
  if (isProd && !force) return null;

  const builder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version ?? process.env.npm_package_version ?? '0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Bearer token issued by `POST /auth/login` (or `/auth/2fa/verify` for 2FA users).',
      },
      'bearer',
    )
    .addServer(`http://localhost:${process.env.PORT ?? '3000'}`, 'Local dev')
    .addServer(`/api/${config.service}`, 'Behind nginx (prod)');

  for (const tag of config.tags ?? []) {
    builder.addTag(tag.name, tag.description);
  }

  const document = SwaggerModule.createDocument(app, builder.build());

  // Mount under `/{service}/docs`; aliased to `/docs` so each
  // service is reachable on either path.
  SwaggerModule.setup(`${config.service}/docs`, app, document, {
    customSiteTitle: `${config.title} â€” Swagger`,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${config.title} â€” Swagger`,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });

  return document;
}
