'use server';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

export type ForgotPasswordResult = { ok: true } | { error: string };

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  const res = await authServiceFetch<{ message: string }>('/auth/forgot-password', {
    body: { email },
  });

  if (!res.ok) {
    if (res.status === 429) {
      return { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
    }
    return { error: extractErrorMessage(res.data, 'Não foi possível enviar o email.') };
  }

  return { ok: true };
}
