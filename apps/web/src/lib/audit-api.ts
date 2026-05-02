import { auth } from '@/auth';

import { getAuthServiceUrl } from './auth-service';

/**
 * Server-side fetch wrapper for the auth-service `/audit/*` routes.
 *
 * Reads the access token from the NextAuth session and attaches it as
 * a Bearer header. `cache: 'no-store'` is mandatory — audit data is
 * always per-request and must never sit in any CDN.
 */

// ---------------------------------------------------------------------------
// Response shapes (mirrored from `services/auth-service/src/modules/audit/`).
// Keep these in lock-step with the backend or you'll get silent type
// drift the next time someone refactors the service.
// ---------------------------------------------------------------------------

export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  resourceId: string | null;
  meta: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditCursorPage {
  items: AuditLogItem[];
  nextCursor: string | null;
  pageSize: number;
}

export interface AuditStats {
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string | null; count: number }>;
  modulesWithErrors: Array<{ module: string; errors: number }>;
  loginsByHour: Array<{ hour: string; count: number }>;
}

export interface SecurityReport {
  failedLoginIps: Array<{ ipAddress: string; failures: number; lastAttemptAt: string }>;
  usersWithManyForbidden: Array<{ userId: string; forbidden: number }>;
  oldSessions: Array<{
    sessionId: string;
    userId: string;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastSeenAt: string | null;
  }>;
}

export type AuditFilters = {
  dateFrom: string;
  dateTo: string;
  userId?: string;
  module?: string;
  action?: string;
  ipAddress?: string;
  cursor?: string;
  pageSize?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

async function authedFetch<T>(
  path: string,
  init: { method?: string; query?: Record<string, string | number | undefined> } = {},
): Promise<{ ok: boolean; status: number; data: T | { message?: string } }> {
  const session = await auth();
  const token = session?.accessToken;
  const url = `${getAuthServiceUrl()}${path}${init.query ? buildQuery(init.query) : ''}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'auth-service indisponível' } };
  }
  let data: T | { message?: string };
  try {
    data = (await res.json()) as T | { message?: string };
  } catch {
    data = { message: 'Resposta inválida do auth-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function listAuditLogs(filters: AuditFilters) {
  return authedFetch<AuditCursorPage>('/audit/logs', { query: filters });
}

export function getAuditStats() {
  return authedFetch<AuditStats>('/audit/stats');
}

export function getUserTimeline(userId: string) {
  return authedFetch<AuditLogItem[]>(`/audit/users/${encodeURIComponent(userId)}/timeline`);
}

export function getSecurityReport() {
  return authedFetch<SecurityReport>('/audit/security-report');
}

/** Streams the CSV through the proxy so the access token never reaches the browser. */
export async function fetchAuditCsv(filters: AuditFilters): Promise<Response> {
  const session = await auth();
  const token = session?.accessToken;
  const url = `${getAuthServiceUrl()}/audit/logs/export${buildQuery(filters)}`;
  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
}
