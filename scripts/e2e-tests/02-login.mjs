/**
 * Test 2: credentials login + OAuth button presence + protected route after login.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const html = await page.content();

  record('login page mentions Google', /google/i.test(html));
  record('login page mentions GitHub', /github/i.test(html));

  const emailLocator = page.locator('input[type="email"], input[name="email"]');
  const passwordLocator = page.locator('input[type="password"], input[name="password"]');
  record('login form has email field', (await emailLocator.count()) > 0);
  record('login form has password field', (await passwordLocator.count()) > 0);

  await emailLocator.first().fill('admin@SZDevs.com');
  await passwordLocator.first().fill('Admin@SZDevs2026');

  const callbackPromise = page.waitForResponse(
    (r) => r.url().includes('/api/auth/callback/credentials') && r.request().method() === 'POST',
    { timeout: 15000 },
  );

  const submit = page
    .locator('button[type="submit"], button:has-text("Entrar")')
    .first();
  await submit.click();

  const cb = await callbackPromise.catch(() => null);
  const cbBody = cb ? await cb.text().catch(() => '') : '';
  record(
    'POST /api/auth/callback/credentials returned without error param',
    !!cb && !/\?error=/.test(cbBody),
    cb ? `status=${cb.status()} body=${cbBody.slice(0, 120)}` : 'no callback hit',
  );

  // Wait for navigation away from /login
  await page.waitForURL((u) => !String(u).includes('/login'), { timeout: 10000 }).catch(() => {});
  console.log('   URL after submit:', page.url());

  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find(
    (c) => /session-token/i.test(c.name) || c.name === 'authjs.session-token',
  );
  record(
    'session cookie set after login',
    Boolean(sessionCookie),
    sessionCookie ? `${sessionCookie.name} httpOnly=${sessionCookie.httpOnly}` : 'no session cookie',
  );

  const sessionResp = await page.evaluate(async () => {
    const r = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  record(
    '/api/auth/session returns authenticated user',
    Boolean(sessionResp.body?.user),
    sessionResp.body?.user?.email ?? 'no user',
  );

  await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle' });
  record(
    'authenticated user can reach /perfil',
    !page.url().includes('/login'),
    `final=${page.url()}`,
  );

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  record(
    'admin user can reach /admin',
    !page.url().includes('/login'),
    `final=${page.url()}`,
  );

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
