/**
 * Bypass the login form and call signIn() directly via fetch to next-auth.
 * Also hit auth-service /auth/login to isolate frontend vs backend bugs.
 */
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Hit auth-service directly first
  const direct = await page.evaluate(async () => {
    const r = await fetch('http://127.0.0.1:4001/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@devtechs.com', password: 'Admin@DevTechs2026' }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log('AUTH-SERVICE /auth/login ->', JSON.stringify(direct, null, 2));

  // Now go to /login then call signIn via fetch to /api/auth/callback/credentials
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  // Get CSRF token first
  const csrf = await page.evaluate(async () => {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    return await r.json();
  });
  console.log('CSRF:', JSON.stringify(csrf));

  // Submit credentials via the canonical NextAuth callback URL
  const callback = await page.evaluate(async (csrfToken) => {
    const form = new URLSearchParams();
    form.set('csrfToken', csrfToken);
    form.set('email', 'admin@devtechs.com');
    form.set('password', 'Admin@DevTechs2026');
    form.set('callbackUrl', '/perfil');
    form.set('json', 'true');
    const r = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      credentials: 'include',
      redirect: 'manual',
    });
    return { status: r.status, redirected: r.redirected, url: r.url, type: r.type, headers: Object.fromEntries(r.headers.entries()) };
  }, csrf.csrfToken);
  console.log('callback ->', JSON.stringify(callback, null, 2));

  const cookies = await ctx.cookies();
  console.log('cookies after callback:', cookies.map((c) => `${c.name}(${c.httpOnly ? 'http' : 'js'})`));

  const session = await page.evaluate(async () => {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    return { status: r.status, body: await r.json() };
  });
  console.log('session after callback:', JSON.stringify(session, null, 2));

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
