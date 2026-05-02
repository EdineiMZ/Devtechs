'use server';

import { cookies } from 'next/headers';

import { auth } from '@/auth';

import { makeDevAccessToken } from './token';

const DEV_ACCESS_TTL_MS = 30 * 60 * 1000; // 30 min

export async function confirmDeveloperAccess(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'Sessão inválida' };

  const authUrl =
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_URL ??
    'http://127.0.0.1:3001';

  let ok = false;
  try {
    const res = await fetch(`${authUrl}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: session.user.email, password }),
      cache:   'no-store',
    });
    // accepts 200 (with or without 2FA) — password was correct either way
    ok = res.status === 200 || res.status === 201;
  } catch {
    return { ok: false, error: 'Serviço de autenticação indisponível' };
  }

  if (!ok) return { ok: false, error: 'Senha incorreta' };

  const exp   = Date.now() + DEV_ACCESS_TTL_MS;
  const token = makeDevAccessToken(exp);

  cookies().set('dev_access', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   DEV_ACCESS_TTL_MS / 1000,
    path:     '/admin/developer',
  });

  return { ok: true };
}
