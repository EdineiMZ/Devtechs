'use server';

import {
  authServiceFetch,
  extractErrorMessage,
  type LoginResponseDto,
  type TwoFactorRequiredDto,
} from '@/lib/auth-service';

export type PreflightResult =
  | { ok: true }
  | { requires2FA: true; tempToken: string }
  | { error: 'INVALID_CREDENTIALS' | 'ACCOUNT_BANNED' | 'RATE_LIMITED' | 'EMAIL_NOT_VERIFIED' };

/**
 * Calls POST /auth/login to detect whether 2FA is required WITHOUT
 * completing the login. Used by the login form to decide whether to
 * show the TOTP input before calling NextAuth's signIn.
 *
 * Why this exists: NextAuth v5 normalises all errors thrown in
 * `authorize` to 'CredentialsSignin', so there is no way to
 * distinguish "wrong password" from "2FA required" via result.error.
 * This server action does the same backend call and returns structured
 * data the client can branch on.
 */
export async function preflightLogin(
  email: string,
  password: string,
): Promise<PreflightResult> {
  const res = await authServiceFetch<LoginResponseDto>('/auth/login', {
    body: { email, password },
  });

  if (!res.ok) {
    const data = res.data as Record<string, unknown>;
    const errCode = typeof data.error === 'string' ? data.error : undefined;
    const message = extractErrorMessage(res.data);

    if (res.status === 429 || errCode === 'LoginBlocked') {
      return { error: 'RATE_LIMITED' };
    }
    if (/inactive|banned|banida/i.test(message)) {
      return { error: 'ACCOUNT_BANNED' };
    }
    return { error: 'INVALID_CREDENTIALS' };
  }

  const loginData = res.data as LoginResponseDto;
  if ('requires2FA' in loginData && (loginData as TwoFactorRequiredDto).requires2FA === true) {
    return {
      requires2FA: true,
      tempToken: (loginData as TwoFactorRequiredDto).tempToken,
    };
  }

  return { ok: true };
}
