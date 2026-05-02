'use server';

import { unstable_update } from '@/auth';
import { authServiceFetch } from '@/lib/auth-service';

/**
 * Server action — verifies the TOTP code against the auth-service and,
 * on success, patches the NextAuth JWT so `twoFactorCompleted = true`.
 */
export async function verifyTwoFaSession(
  code: string,
  accessToken: string,
  _callbackUrl: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!code || code.length !== 6) {
    return { ok: false, message: 'Código inválido.' };
  }

  const res = await authServiceFetch<{ verified: boolean }>(
    '/auth/2fa/verify-session',
    {
      method: 'POST',
      body: { code },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok) {
    const data = res.data as Record<string, unknown>;
    const msg =
      typeof data.message === 'string'
        ? data.message
        : 'Código incorreto. Tente novamente.';
    return { ok: false, message: msg };
  }

  // Patch the JWT so the session now reflects twoFactorCompleted = true.
  // The `jwt` callback picks this up via `trigger === 'update'`.
  await unstable_update({ twoFactorCompleted: true });

  return { ok: true };
}
