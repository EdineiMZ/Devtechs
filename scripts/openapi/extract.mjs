#!/usr/bin/env node
/**
 * Extract OpenAPI documents from every NestJS service WITHOUT spinning
 * up real HTTP listeners.
 *
 * How it works:
 *   - For each service, run `node dist/main.js` with
 *     `OPENAPI_EXTRACT_TO=docs/openapi/<slug>.json` set in env.
 *   - The service's `main.ts` reads that var, calls
 *     `SwaggerModule.createDocument(app, builder.build())`, writes the
 *     document to disk, then `app.close()` — never binding a port.
 *
 * Pre-reqs:
 *   - Each service must already be built (`pnpm build`). We don't run
 *     it here because that would silently rebuild the world; CI is
 *     supposed to chain `build → docs:generate`.
 *
 * Output:
 *   docs/openapi/{auth,rh,finance,projects,support,payments,license,
 *                 developer,notification}.json
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const OUT_DIR = resolve(REPO_ROOT, 'docs', 'openapi');
mkdirSync(OUT_DIR, { recursive: true });

const SERVICES = [
  { dir: 'auth-service', slug: 'auth' },
  { dir: 'rh-service', slug: 'rh' },
  { dir: 'finance-service', slug: 'finance' },
  { dir: 'projects-service', slug: 'projects' },
  { dir: 'support-service', slug: 'support' },
  { dir: 'payments-service', slug: 'payments' },
  { dir: 'license-service', slug: 'license' },
  { dir: 'developer-service', slug: 'developer' },
  { dir: 'notification-service', slug: 'notification' },
];

let failures = 0;
for (const svc of SERVICES) {
  const distMain = resolve(REPO_ROOT, 'services', svc.dir, 'dist', 'main.js');
  if (!existsSync(distMain)) {
    console.warn(`[extract] ${svc.dir}: dist/main.js missing — run 'pnpm build' first. Skipping.`);
    failures += 1;
    continue;
  }

  const outPath = resolve(OUT_DIR, `${svc.slug}.json`);
  // EXPOSE_SWAGGER_IN_PROD=true so setupSwagger() runs even when
  // NODE_ENV=production (it short-circuits otherwise). Override the
  // service port to 0 (kernel assigns) — irrelevant since we exit
  // before binding, but keeps an unintentional listen safe.
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    EXPOSE_SWAGGER_IN_PROD: 'true',
    OPENAPI_EXTRACT_TO: outPath,
    PORT: '0',
    // Quiet mode — the service loggers add a lot of noise we don't
    // need when we're just dumping a JSON file.
    LOG_LEVEL: 'error',
  };

  console.log(`[extract] ${svc.dir} → ${outPath}`);
  const result = spawnSync(process.execPath, [distMain], {
    cwd: resolve(REPO_ROOT, 'services', svc.dir),
    env,
    stdio: 'inherit',
    timeout: 60_000,
  });

  if (result.status !== 0) {
    console.error(`[extract] ${svc.dir} FAILED (exit ${result.status})`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\n${failures} service(s) failed to produce an OpenAPI doc.`);
  process.exit(1);
}
console.log(`\n${SERVICES.length} OpenAPI documents written to ${OUT_DIR}.`);
