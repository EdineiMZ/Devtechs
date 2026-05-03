import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const cfg = JSON.parse(readFileSync(resolve(ROOT, 'scripts/.services-readme-config.json'), 'utf8'));

for (const [svc, m] of Object.entries(cfg)) {
  const slug = svc.replace('-service', '');
  const lines = [];
  lines.push(`# ${m.title}`);
  lines.push('');
  lines.push(m.tagline);
  lines.push('');
  lines.push(
    'Part of the [SZDevs](../../README.md) monorepo. NestJS 10 + Prisma + Postgres + Redis. ' +
      'Tokens issued/validated against [auth-service](../auth-service/README.md).',
  );
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push(
    'Copy `.env.example` at the repo root and set the keys below. The service exits with a non-zero status if anything required is missing.',
  );
  lines.push('');
  lines.push('| Var | Default | Notes |');
  lines.push('| --- | --- | --- |');
  lines.push(`| \`${m.envPort}\` / \`PORT\` | \`${m.port}\` | TCP port to bind. |`);
  lines.push('| `DATABASE_URL` | â€” | Postgres connection string. Schema in [packages/database](../../packages/database). |');
  lines.push('| `REDIS_URL` | â€” | Used by rate-limit + cache. Dev-tolerated when offline. |');
  for (const e of m.extraEnv) {
    const idx = e.indexOf(' â€” ');
    if (idx > 0) {
      lines.push(`| \`${e.slice(0, idx)}\` | â€” | ${e.slice(idx + 3)} |`);
    } else {
      lines.push(`| \`${e}\` | â€” | |`);
    }
  }
  lines.push('');
  lines.push('## Run locally');
  lines.push('');
  lines.push('```bash');
  lines.push('# 1. Bring up Postgres + Redis (compose default profile).');
  lines.push('docker compose -f infra/docker-compose.yml up -d');
  lines.push('');
  lines.push("# 2. Apply migrations + seed if you haven't already.");
  lines.push('pnpm db:migrate && pnpm db:seed');
  lines.push('');
  lines.push('# 3. Start the service in watch mode.');
  lines.push(`pnpm --filter @szdevs/${svc} dev`);
  lines.push('');
  lines.push('# 4. Production-style start (after pnpm build).');
  lines.push(`pnpm --filter @szdevs/${svc} start`);
  lines.push('```');
  lines.push('');
  lines.push(
    `Swagger UI is mounted at \`http://localhost:${m.port}/${slug}/docs\` (disabled when ` +
      '`NODE_ENV=production` unless `EXPOSE_SWAGGER_IN_PROD=true`).',
  );
  lines.push('');
  lines.push('## Endpoints');
  lines.push('');
  for (const e of m.endpoints) lines.push(`- ${e}`);
  lines.push('');
  lines.push(
    `Full reference (request/response shapes, examples) lives at \`/docs\` (Redoc, unified across all services) or \`/${slug}/docs\` (this service's Swagger UI).`,
  );
  lines.push('');
  lines.push('## Tests');
  lines.push('');
  lines.push('```bash');
  lines.push(`pnpm --filter @szdevs/${svc} typecheck   # tsc --noEmit`);
  lines.push(`pnpm --filter @szdevs/${svc} lint        # eslint`);
  lines.push(`pnpm --filter @szdevs/${svc} test        # jest unit suite`);
  if (svc === 'auth-service') {
    lines.push(
      `pnpm --filter @szdevs/${svc} test:int    # supertest integration suite (needs Postgres + Redis up)`,
    );
  }
  lines.push('```');
  lines.push('');
  lines.push(
    'E2E tests at the repo root cover the full HTTP surface against a running service stack. See [playwright.config.ts](../../playwright.config.ts).',
  );
  lines.push('');

  const outPath = resolve(ROOT, 'services', svc, 'README.md');
  writeFileSync(outPath, lines.join('\n'));
  console.log(`wrote ${outPath}`);
}
