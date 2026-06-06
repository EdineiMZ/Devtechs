'use server';

import { headers as nextHeaders } from 'next/headers';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

export interface ResetPasswordResult {
  ok: boolean;
  requires2FA?: boolean;
  message?: string;
  error?: string;
}

export interface ResetTokenInfo {
  valid: boolean;
  requires2FA: boolean;
  expiresAt: string;
}

export async function getResetTokenInfo(token: string): Promise<ResetTokenInfo> {
  const res = await authServiceFetch<ResetTokenInfo>(
    `/auth/reset-password/info?token=${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
  if (!res.ok) return { valid: false, requires2FA: false, expiresAt: '' };
  return res.data as ResetTokenInfo;
}

export async function resetPasswordAction(
  token: string,
  newPassword: string,
  confirmPassword: string,
  totpCode?: string,
): Promise<ResetPasswordResult> {
  const h = await nextHeaders();
  const clientIp =
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined;

  const res = await authServiceFetch<{ message: string; requires2FA?: boolean }>(
    '/auth/reset-password',
    {
      body: { token, newPassword, confirmPassword, totpCode },
      headers: clientIp ? { 'x-real-ip': clientIp } : undefined,
    },
  );

  if (!res.ok) {
    return { ok: false, error: extractErrorMessage(res.data) };
  }

  const data = res.data as { message: string; requires2FA?: boolean };
  if (data.requires2FA) {
    return { ok: false, requires2FA: true };
  }

  return { ok: true, message: data.message };
}