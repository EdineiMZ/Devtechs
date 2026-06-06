'use server';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

export interface RegisterActionResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

export async function registerAction(data: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<RegisterActionResult> {
  const res = await authServiceFetch<{ message: string; userId: string }>(
    '/auth/register',
    { body: data },
  );

  if (!res.ok) {
    return { ok: false, error: extractErrorMessage(res.data) };
  }

  const body = res.data as { message: string; userId: string };
  return { ok: true, userId: body.userId };
}
