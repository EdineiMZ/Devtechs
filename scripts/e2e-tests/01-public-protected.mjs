/**
 * Smoke test: public routes accessible, protected routes redirect to /login.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function check(page, path, { expectStatus, expectRedirectTo }) {
  const url = `${BASE}${path}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  const finalUrl = page.url();
  const status = resp ? resp.status() : 0;
  if (expectStatus && status !== expectStatus) {
    record(`GET ${path}`, false, `status=${status} (expected ${expectStatus})`);
    return;
  }
  if (expectRedirectTo) {
    const expected = `${BASE}${expectRedirectTo}`;
    if (!finalUrl.startsWith(expected)) {
      record(`GET ${path} redirect`, false, `final=${finalUrl} (expected to start with ${expected})`);
      return;
    }
  }
  record(`GET ${path}`, true, `status=${status} final=${finalUrl}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Public routes
  await check(page, '/', { expectStatus: 200 });
  await check(page, '/login', { expectStatus: 200 });
  await check(page, '/register', { expectStatus: 200 });
  await check(page, '/contato', { expectStatus: 200 });

  // Protected routes — anonymous should be redirected to /login
  await check(page, '/perfil', { expectRedirectTo: '/login' });
  await check(page, '/admin', { expectRedirectTo: '/login' });
  await check(page, '/verificar-email', { expectRedirectTo: '/login' });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
