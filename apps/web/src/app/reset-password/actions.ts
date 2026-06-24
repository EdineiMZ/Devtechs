'use server';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

export type ValidateTokenResult = { valid: true } | { error: string };
export type ResetPasswordResult = { ok: true } | { error: string };

export async function validateResetToken(
  token: string,
  email: string,
): Promise<ValidateTokenResult> {
  const params = new URLSearchParams({ token, email });
  const res = await authServiceFetch<{ valid: boolean }>(
    `/auth/reset-password/validate?${params.toString()}`,
    { method: 'GET' },
  );

  if (!res.ok) {
    return { error: 'Link expirado ou inválido. Solicite um novo.' };
  }

  return { valid: true };
}

export async function resetPassword(
  token: string,
  email: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const res = await authServiceFetch<{ message: string }>('/auth/reset-password', {
    body: { token, email, newPassword },
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 410 || res.status === 422) {
      return { error: 'Link de redefinição inválido ou expirado. Solicite um novo.' };
    }
    if (res.status === 429) {
      return { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
    }
    return { error: extractErrorMessage(res.data, 'Não foi possível redefinir sua senha.') };
  }

  return { ok: true };
}
