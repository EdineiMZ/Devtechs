'use server';

import { cookies } from 'next/headers';

import { auth } from '@/auth';

import { makeDevAccessToken } from './token';

const DEV_ACCESS_TTL_MS = 30 * 60 * 1000; // 30 min

function getAuthUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_URL ??
    'http://127.0.0.1:4001'
  );
}

/**
 * Step 1 — Verify the user's account password.
 *
 * • No 2FA on account  → sets the dev_access cookie immediately and returns `{ ok: true }`.
 * • 2FA enabled        → returns `{ ok: false, requires2FA: true, tempToken }` so the client
 *                        can proceed to the TOTP step without receiving the cookie yet.
 * • Wrong password     → returns `{ ok: false, error: 'Senha incorreta' }`.
 */
export async function confirmDeveloperAccess(
  password: string,
): Promise<{ ok: boolean; requires2FA?: true; tempToken?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'Sessão inválida' };

  let status: number;
  let data: Record<string, unknown>;

  try {
    const res = await fetch(`${getAuthUrl()}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: session.user.email, password }),
      cache:   'no-store',
    });
    status = res.status;
    data   = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Serviço de autenticação indisponível' };
  }

  if (status !== 200 && status !== 201) {
    return { ok: false, error: 'Senha incorreta' };
  }

  // Account has 2FA enabled → client must complete the TOTP step first
  if (data.requires2FA === true && typeof data.tempToken === 'string') {
    return { ok: false, requires2FA: true, tempToken: data.tempToken };
  }

  // No 2FA — grant access directly
  grantDevAccess();
  return { ok: true };
}

/**
 * Step 2 — Verify the authenticator TOTP code using the tempToken that
 * `/auth/login` issued during step 1. On success the dev_access cookie is set.
 */
export async function confirmDeveloperTOTP(
  tempToken: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getAuthUrl()}/auth/2fa/verify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tempToken, code }),
      cache:   'no-store',
    });

    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, error: 'Código inválido ou expirado. Tente novamente.' };
    }
  } catch {
    return { ok: false, error: 'Serviço de autenticação indisponível' };
  }

  grantDevAccess();
  return { ok: true };
}

// ─── Internal ──────────────────────────────────────────────────────────

function grantDevAccess(): void {
  const exp   = Date.now() + DEV_ACCESS_TTL_MS;
  const token = makeDevAccessToken(exp);

  cookies().set('dev_access', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   DEV_ACCESS_TTL_MS / 1000,
    path:     '/admin/developer',
  });
}
