/**
 * Test 4: Module routes consolidated into apps/web.
 *
 * After the consolidation, the standalone module apps on :3001-3007
 * were retired. All admin modules now live as sub-routes inside
 * `apps/web` on :3000 and the only other Next.js surface left is
 * the public planos/checkout app on :3006 (apps/store).
 *
 * Acceptance:
 *   - GET http://localhost:3000/                → 200 (public)
 *   - GET http://localhost:3000/admin/<module>  → 307 to /login (anon)
 *   - GET http://localhost:3000/perfil          → 307 to /login (anon)
 *   - The legacy ports (3001..3007 except 3006) MUST refuse the
 *     connection — confirmation that nothing is leaking auth-bearing
 *     content under a port without the middleware gate.
 */

const WEB = 'http://localhost:3000';
const STORE = 'http://localhost:3006';
const RETIRED_PORTS = [3001, 3002, 3003, 3004, 3005, 3007];
const ADMIN_MODULES = [
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
];
const CLIENT_ROUTES = [
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

async function probe(url) {
  // `redirect: 'manual'` so we observe the 307 instead of the
  // post-redirect /login HTML.
  try {
    const r = await fetch(url, { redirect: 'manual' });
    return { status: r.status, location: r.headers.get('location') };
  } catch (err) {
    return { error: err.message };
  }
}

(async () => {
  // 1) Public landing on :3000 serves anonymously.
  let r = await probe(`${WEB}/`);
  record(
    'web :3000 / serves anonymously',
    r.status === 200,
    `status=${r.status}`,
  );

  // 2) Public planos page on :3006 serves anonymously.
  r = await probe(`${STORE}/planos`);
  record(
    'store :3006 /planos serves anonymously',
    r.status === 200 || r.status === 307,
    `status=${r.status}`,
  );

  // 3) Every admin module redirects anonymous traffic to /login.
  for (const path of ADMIN_MODULES) {
    r = await probe(`${WEB}${path}`);
    const isRedirect = r.status === 307 || r.status === 302;
    const goesToLogin = (r.location ?? '').includes('/login');
    record(
      `${path} bounces anonymous → /login`,
      isRedirect && goesToLogin,
      `status=${r.status} location=${r.location ?? '(none)'}`,
    );
  }

  // 4) Client portal sub-routes also bounce anonymous traffic.
  for (const path of CLIENT_ROUTES) {
    r = await probe(`${WEB}${path}`);
    const isRedirect = r.status === 307 || r.status === 302;
    const goesToLogin = (r.location ?? '').includes('/login');
    record(
      `${path} bounces anonymous → /login`,
      isRedirect && goesToLogin,
      `status=${r.status} location=${r.location ?? '(none)'}`,
    );
  }

  // 5) Retired ports MUST refuse connections.
  for (const port of RETIRED_PORTS) {
    r = await probe(`http://localhost:${port}/`);
    const refused = r.error !== undefined;
    record(
      `legacy :${port} refuses connections`,
      refused,
      r.error ? `err=${r.error.slice(0, 60)}` : `status=${r.status}`,
    );
  }

  const passed = results.filter((x) => x.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
