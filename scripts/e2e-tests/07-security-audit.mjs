/**
 * Test 7: Security audit on auth-service + Next.js middleware boundary.
 *
 * Original concerns:
 *   - protected /auth endpoints reject unauthenticated requests
 *   - /auth/me requires bearer token
 *   - protected admin endpoints require admin role
 *   - common headers (cors, content-type sniffing, frame options)
 *
 * Post-consolidation extras (this PR):
 *   - retired module ports MUST be unreachable (no anon UI)
 *   - every /admin/* and /perfil/* sub-route bounces anonymous to
 *     /login — confirms the middleware gate covers the new surface
 */

const AUTH = 'http://127.0.0.1:4001';
const WEB = 'http://localhost:3000';

// After consolidation we keep only :3000 (web) and :3006 (store) as
// Next.js surfaces. The rest (3001 RH, 3002 financeiro, 3003 projetos,
// 3004 devops, 3005 suporte, 3007 developer) were retired — leaving a
// listener up on any of them is a regression and a security finding.
const RETIRED_NEXTJS_PORTS = [3001, 3002, 3003, 3004, 3005, 3007];

// Routes that MUST require a session.
const PROTECTED_WEB_ROUTES = [
  '/admin',
  '/admin/rh',
  '/admin/financeiro',
  '/admin/projetos',
  '/admin/devops',
  '/admin/suporte',
  '/admin/developer',
  '/admin/developer/logs',
  '/admin/developer/config',
  '/admin/developer/queues',
  '/admin/configuracoes',
  '/perfil',
  '/perfil/tickets',
  '/perfil/tickets/novo',
  '/perfil/faturas',
  '/perfil/notificacoes',
  '/perfil/configuracoes',
  '/perfil/configuracoes/seguranca',
  '/perfil/configuracoes/2fa',
];

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function jsonFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  const raw = await r.text();
  let body = raw;
  try { body = JSON.parse(raw); } catch { /* keep raw */ }
  return { status: r.status, body, headers: Object.fromEntries(r.headers.entries()) };
}

(async () => {
  // ---------- auth-service ----------
  let res = await jsonFetch(`${AUTH}/auth/me`);
  record('/auth/me without token returns 401', res.status === 401, `status=${res.status}`);

  res = await jsonFetch(`${AUTH}/auth/audit`);
  record('/auth/audit without token returns 401', res.status === 401, `status=${res.status}`);

  res = await jsonFetch(`${AUTH}/roles`);
  record('/roles without token returns 401', res.status === 401, `status=${res.status}`);

  res = await jsonFetch(`${AUTH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@devtechs.com', password: 'WrongPasswordX!' }),
  });
  record('wrong password rejected (4xx)', res.status >= 400 && res.status < 500, `status=${res.status}`);

  res = await jsonFetch(`${AUTH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: "' OR 1=1--", password: 'whatever' }),
  });
  record('invalid email shape rejected by validator', res.status === 400, `status=${res.status}`);

  // ---------- web middleware gate ----------
  for (const path of PROTECTED_WEB_ROUTES) {
    const r = await fetch(`${WEB}${path}`, { redirect: 'manual' });
    const isRedirect = r.status === 307 || r.status === 302;
    const loc = r.headers.get('location') ?? '';
    record(
      `${path} requires session (redirects anon to /login)`,
      isRedirect && loc.includes('/login'),
      `status=${r.status} location=${loc || '(none)'}`,
    );
  }

  // ---------- session leak check ----------
  res = await jsonFetch(`${WEB}/api/auth/session`);
  record(
    '/api/auth/session without cookie returns no user',
    res.status === 200 && (res.body === null || !res.body?.user),
    `body=${JSON.stringify(res.body).slice(0, 80)}`,
  );

  // ---------- info disclosure ----------
  res = await jsonFetch(`${WEB}/`);
  const xPoweredBy = res.headers['x-powered-by'];
  record(
    'web does not advertise X-Powered-By: Next.js',
    !xPoweredBy || !/next/i.test(xPoweredBy),
    `header=${xPoweredBy ?? 'absent'}`,
  );

  // ---------- CORS ----------
  res = await jsonFetch(`${AUTH}/auth/me`, {
    headers: { Origin: 'https://evil.example.com' },
  });
  const acao = res.headers['access-control-allow-origin'];
  record(
    'auth-service does not echo arbitrary Origin in ACAO',
    !acao || acao !== 'https://evil.example.com',
    `ACAO=${acao ?? 'absent'}`,
  );

  // ---------- retired module ports ----------
  for (const port of RETIRED_NEXTJS_PORTS) {
    const reachable = await fetch(`http://localhost:${port}/`).then(
      () => true,
      () => false,
    );
    record(
      `legacy :${port} unreachable (no anonymous UI)`,
      !reachable,
      reachable ? 'STILL LISTENING — retire it!' : 'connection refused',
    );
  }

  // ---------- summary ----------
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} security checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
