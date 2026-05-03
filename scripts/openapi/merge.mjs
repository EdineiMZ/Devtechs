#!/usr/bin/env node
/**
 * Merge per-service OpenAPI documents into a single `openapi.unified.json`
 * that Redoc serves on `/docs`.
 *
 * Why we don't use a third-party merger: the existing tools
 * (`swagger-merge`, `openapi-merge`) are either unmaintained or
 * pull a small army of transitive deps. Our merge needs are
 * specific and predictable:
 *
 *   - **Path prefixing**: every service's path is rewritten to
 *     `/{service}{originalPath}`. So `auth-service`'s `/auth/login`
 *     becomes `/auth/auth/login`... wait â€” that double-prefixes.
 *     We don't double-prefix. Each service's existing controller
 *     paths already start with the service slug (e.g. `auth/login`,
 *     `rh/employees`), so we leave them as-is.
 *
 *   - **Component name collisions**: two services may both export a
 *     DTO called `LoginDto`. We namespace components per-service
 *     (`Auth.LoginDto`, `Finance.LoginDto`) so the merged spec is
 *     valid. References inside each service's spec are rewritten to
 *     match.
 *
 *   - **Tag deduplication**: tags are union-ed; identically named
 *     tags from different services collapse into one (the first
 *     description wins).
 *
 *   - **Servers**: dropped from per-service docs, replaced with a
 *     single `servers: [{ url: '/api' }]` so Redoc resolves all paths
 *     relative to the nginx-proxied base.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const IN_DIR = resolve(REPO_ROOT, 'docs', 'openapi');
const OUT_PATH = resolve(REPO_ROOT, 'docs', 'openapi.unified.json');

function namespace(name, slug) {
  // Capitalize slug for a CamelCase-ish prefix that's still valid.
  return `${slug[0].toUpperCase()}${slug.slice(1)}.${name}`;
}

/** Walk every $ref in a value tree and rewrite component names. */
function rewriteRefs(node, slug) {
  if (Array.isArray(node)) {
    for (const item of node) rewriteRefs(item, slug);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === '$ref' && typeof v === 'string' && v.startsWith('#/components/schemas/')) {
        const name = v.slice('#/components/schemas/'.length);
        node[k] = `#/components/schemas/${namespace(name, slug)}`;
      } else {
        rewriteRefs(v, slug);
      }
    }
  }
}

const merged = {
  openapi: '3.0.0',
  info: {
    title: 'SZDevs â€” Unified API',
    description:
      'Aggregated OpenAPI specification for every NestJS microservice. ' +
      'Served at `/docs` via Redoc; per-service Swagger UIs live at ' +
      '`/auth/docs`, `/rh/docs`, etc.',
    version: process.env.npm_package_version ?? '0.1.0',
  },
  servers: [
    { url: '/api', description: 'Behind nginx (prod)' },
    { url: 'http://localhost', description: 'Local dev (nginx on :80)' },
  ],
  tags: [],
  paths: {},
  components: {
    schemas: {},
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Bearer token issued by `POST /auth/login`.',
      },
    },
  },
};

const seenTags = new Map();
const files = readdirSync(IN_DIR).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`No service specs in ${IN_DIR}. Run 'pnpm docs:extract' first.`);
  process.exit(1);
}

for (const file of files) {
  const slug = basename(file, '.json');
  const doc = JSON.parse(readFileSync(resolve(IN_DIR, file), 'utf8'));
  console.log(`[merge] ${slug} (${Object.keys(doc.paths ?? {}).length} paths)`);

  // 1. Rewrite refs in the whole doc.
  rewriteRefs(doc, slug);

  // 2. Tags â€” first wins.
  for (const tag of doc.tags ?? []) {
    if (!seenTags.has(tag.name)) {
      seenTags.set(tag.name, tag);
    }
  }

  // 3. Schemas â€” namespace.
  for (const [name, schema] of Object.entries(doc.components?.schemas ?? {})) {
    merged.components.schemas[namespace(name, slug)] = schema;
  }

  // 4. Paths â€” copy as-is. Per-service paths already start with their
  //    slug because controllers are mounted on `@Controller('auth')`,
  //    `@Controller('rh/employees')`, etc.
  for (const [pathKey, ops] of Object.entries(doc.paths ?? {})) {
    if (merged.paths[pathKey]) {
      console.warn(`  collision on path ${pathKey} from ${slug} â€” overwriting`);
    }
    merged.paths[pathKey] = ops;
  }
}

merged.tags = Array.from(seenTags.values());

mkdirSync(resolve(REPO_ROOT, 'docs'), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));
console.log(
  `\nMerged ${files.length} specs â†’ ${OUT_PATH} (${Object.keys(merged.paths).length} paths, ${
    Object.keys(merged.components.schemas).length
  } schemas).`,
);
