/**
 * Frontend wrapper around the auth-service `/auth/me*` and `/auth/2fa*`
 * endpoints. We always go through the Next.js Node layer (server
 * components / route handlers / server actions) so we can attach the
 * bearer token from the NextAuth session — the browser never holds it
 * directly.
 */

import { authServiceFetch, getAuthServiceUrl } from './auth-service';

export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: string;
  createdAt: string;
}

export interface AccountSession {
  id: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  current: boolean;
}

export interface ChangePasswordResult {
  message: string;
  revokedSessionCount: number;
}

export interface Setup2FAResult {
  qrCode: string;
  manualKey: string;
  otpauthUrl: string;
}

export interface Enable2FAResult {
  message: string;
  enabledAt: string;
  recoveryCodes: string[];
}

export interface Disable2FAResult {
  message: string;
  disabledAt: string;
}

export interface RecoveryCodesResult {
  recoveryCodes: string[];
}

/**
 * Server-side authed fetch — attaches the Bearer header. Designed
 * to be called from server components or server actions in the web
 * app, not from client components (those should hit the local
 * `/api/account/*` proxy routes that re-attach the cookie session).
 */
async function authedFetch<T>(
  path: string,
  accessToken: string,
  init: { method?: string; body?: unknown; realIp?: string } = {},
): ReturnType<typeof authServiceFetch<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (init.realIp) headers['x-real-ip'] = init.realIp;
  return authServiceFetch<T>(path, {
    method: init.method ?? 'GET',
    body: init.body,
    headers,
  });
}

// ---------- profile ----------

export function getProfile(accessToken: string) {
  return authedFetch<AccountProfile>('/auth/me', accessToken, { method: 'GET' });
}

export function updateProfile(
  patch: { name?: string; avatarUrl?: string | null },
  accessToken: string,
  realIp?: string,
) {
  return authedFetch<AccountProfile>('/auth/me', accessToken, {
    method: 'PATCH',
    body: patch,
    realIp,
  });
}

// ---------- password ----------

export function changePassword(
  body: { currentPassword: string; newPassword: string },
  accessToken: string,
  realIp?: string,
) {
  return authedFetch<ChangePasswordResult>('/auth/me/password', accessToken, {
    method: 'POST',
    body,
    realIp,
  });
}

// ---------- sessions ----------

export function listSessions(accessToken: string) {
  return authedFetch<AccountSession[]>('/auth/me/sessions', accessToken, {
    method: 'GET',
  });
}

export function revokeSession(sessionId: string, accessToken: string, realIp?: string) {
  return authedFetch<{ ok: true }>(
    `/auth/me/sessions/${encodeURIComponent(sessionId)}`,
    accessToken,
    { method: 'DELETE', realIp },
  );
}

// ---------- 2FA ----------

export function setup2FA(accessToken: string, realIp?: string) {
  return authedFetch<Setup2FAResult>('/auth/2fa/setup', accessToken, {
    method: 'POST',
    realIp,
  });
}

export function enable2FA(code: string, accessToken: string, realIp?: string) {
  return authedFetch<Enable2FAResult>('/auth/2fa/enable', accessToken, {
    method: 'POST',
    body: { code },
    realIp,
  });
}

export function disable2FA(
  body: { currentPassword: string; code?: string },
  accessToken: string,
  realIp?: string,
) {
  return authedFetch<Disable2FAResult>('/auth/2fa/disable', accessToken, {
    method: 'POST',
    body,
    realIp,
  });
}

export function requestDisableEmailCode(accessToken: string, realIp?: string) {
  return authedFetch<{ message: string }>(
    '/auth/2fa/request-disable-otp',
    accessToken,
    { method: 'POST', realIp },
  );
}

export function disable2FAViaEmailOtp(
  body: { currentPassword: string; emailOtp: string },
  accessToken: string,
  realIp?: string,
) {
  return authedFetch<Disable2FAResult>('/auth/2fa/disable-with-otp', accessToken, {
    method: 'POST',
    body,
    realIp,
  });
}

export function regenerateRecoveryCodes(accessToken: string, realIp?: string) {
  return authedFetch<RecoveryCodesResult>(
    '/auth/2fa/recovery-codes',
    accessToken,
    { method: 'POST', realIp },
  );
}

// ---------- shared helpers re-exported for the API routes ----------

export { getAuthServiceUrl };
