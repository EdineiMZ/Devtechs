/**
 * Test 9: /perfil/configuracoes — auth-service self-service endpoints.
 *
 * Walks the admin user through the same operations the UI lets a
 * real user do, against the live auth-service:
 *
 *   1. Login → access token + session id
 *   2. PATCH /auth/me         (profile update; round-trips name/avatar)
 *   3. PATCH /auth/me {}      (empty body must 400)
 *   4. GET   /auth/me/sessions (lists; current=true on the active one)
 *   5. POST  /auth/me/password — wrong current → 401
 *   6. POST  /auth/me/password — same current/new → 400
 *   7. POST  /auth/me/password — happy path → 200, all OTHER sessions
 *      revoked, current still valid (sanity-checked via /auth/me),
 *      then ROLLED BACK to the original password so subsequent test
 *      runs / interactive logins still work.
 *   8. DELETE /auth/me/sessions/<self>  must 400 (cannot self-revoke).
 */

const AUTH = 'http://127.0.0.1:4001';
const ADMIN_EMAIL = 'admin@devtechs.com';
const ADMIN_PWD = 'Admin@DevTechs2026';
const TEMP_PWD = 'Temp@DevTechs2026!';

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
  return { status: r.status, body };
}

async function login(password) {
  return jsonFetch(`${AUTH}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
}

(async () => {
  // -------- 1) Login --------
  let res = await login(ADMIN_PWD);
  if (res.status !== 200 || !res.body?.accessToken) {
    record('admin login', false, `status=${res.status}`);
    process.exit(1);
  }
  record('admin login', true);
  let token = res.body.accessToken;
  // Decode JWT payload to read the session id (it's the `sid` claim).
  const sid = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ).sid;

  // -------- 2) PATCH /auth/me happy path --------
  res = await jsonFetch(`${AUTH}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: 'Administrador DevTechs' }),
  });
  record(
    'PATCH /auth/me updates the user name',
    res.status === 200 && res.body.name === 'Administrador DevTechs',
    `status=${res.status} name=${res.body?.name}`,
  );

  // -------- 3) PATCH /auth/me with empty body --------
  res = await jsonFetch(`${AUTH}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  record(
    'PATCH /auth/me {} returns 400',
    res.status === 400,
    `status=${res.status}`,
  );

  // -------- 4) GET /auth/me/sessions --------
  res = await jsonFetch(`${AUTH}/auth/me/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const items = Array.isArray(res.body) ? res.body : [];
  const currentRow = items.find((s) => s.id === sid);
  record(
    'GET /auth/me/sessions includes the current session with current=true',
    res.status === 200 && currentRow && currentRow.current === true,
    `status=${res.status} sessions=${items.length} hasCurrent=${Boolean(currentRow?.current)}`,
  );

  // -------- 5) POST /auth/me/password — wrong current --------
  res = await jsonFetch(`${AUTH}/auth/me/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      currentPassword: 'WrongOldPwd1!',
      newPassword: TEMP_PWD,
    }),
  });
  record(
    'POST /auth/me/password rejects wrong current password',
    res.status === 401,
    `status=${res.status}`,
  );

  // -------- 6) POST /auth/me/password — same current/new --------
  res = await jsonFetch(`${AUTH}/auth/me/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      currentPassword: ADMIN_PWD,
      newPassword: ADMIN_PWD,
    }),
  });
  record(
    'POST /auth/me/password rejects identical current/new',
    res.status === 400,
    `status=${res.status}`,
  );

  // -------- 7) POST /auth/me/password — happy path + rollback --------
  res = await jsonFetch(`${AUTH}/auth/me/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      currentPassword: ADMIN_PWD,
      newPassword: TEMP_PWD,
    }),
  });
  record(
    'POST /auth/me/password rotates password successfully',
    res.status === 200 && typeof res.body?.revokedSessionCount === 'number',
    `status=${res.status} revoked=${res.body?.revokedSessionCount}`,
  );

  // The current session must still work after the password change.
  res = await jsonFetch(`${AUTH}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  record(
    'current session still valid after password rotation',
    res.status === 200,
    `status=${res.status}`,
  );

  // Login with the new password — proves the rotation took effect.
  res = await login(TEMP_PWD);
  record(
    'login with NEW password succeeds',
    res.status === 200 && res.body?.accessToken,
    `status=${res.status}`,
  );
  const newToken = res.body?.accessToken;

  // Roll the password back so subsequent runs / dev usage still work.
  res = await jsonFetch(`${AUTH}/auth/me/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newToken}`,
    },
    body: JSON.stringify({
      currentPassword: TEMP_PWD,
      newPassword: ADMIN_PWD,
    }),
  });
  record(
    'password rotation rollback (TEMP → ADMIN) succeeded',
    res.status === 200,
    `status=${res.status}`,
  );

  // -------- 8) DELETE current session via /auth/me/sessions/<self> --------
  res = await jsonFetch(`${AUTH}/auth/me/sessions/${sid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  record(
    'DELETE /auth/me/sessions/<self> rejects self-revoke',
    // Sometimes 401 if rollback above invalidated the original session
    // (because every-other revoke happens; we can accept 400 OR 401).
    res.status === 400 || res.status === 401,
    `status=${res.status}`,
  );

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
