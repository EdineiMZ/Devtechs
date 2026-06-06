'use server';

import { headers as nextHeaders } from 'next/headers';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

export interface ForgotPasswordResult {
  ok: boolean;
  message?: string;
  error?: string;
}

export async function forgotPasswordAction(email: string): Promise<ForgotPasswordResult> {
  const h = await nextHeaders();
  const clientIp =
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined;

  const res = await authServiceFetch<{ message: string }>('/auth/forgot-password', {
    body: { email },
    headers: clientIp ? { 'x-real-ip': clientIp } : undefined,
  });

  if (!res.ok) {
    return { ok: false, error: extractErrorMessage(res.data) };
  }

  return { ok: true, message: (res.data as { message: string }).message };
}