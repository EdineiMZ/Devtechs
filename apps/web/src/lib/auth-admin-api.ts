import { auth } from '@/auth';

import { getAuthServiceUrl } from './auth-service';

/**
 * auth-admin-api.ts — typed REST wrapper for the auth-service admin routes.
 *
 * Covers: /roles, /permissions, /audit, and user management.
 * Requires `dev:config:edit` or `admin` role for most operations.
 */

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('auth-admin-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('auth-admin-api: no active session');
  return session.accessToken;
}

async function request<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    accessToken?: string;
  } = {},
): Promise<ApiResult<T>> {
  const token = await resolveToken(init.accessToken);

  const params = init.query
    ? '?' +
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const url = `${getAuthServiceUrl()}${path}${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'auth-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do auth-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

export interface PermissionSummary {
  id: string;
  key: string;
  name: string;
  module: string;
  description: string | null;
}

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  requireEmailVerified: boolean;
  require2FA: boolean;
  createdAt: string;
  permissions: PermissionSummary[];
}

export interface PermissionsByModuleResponse {
  [module: string]: PermissionSummary[];
}

/** Raw shape returned by GET /permissions on the auth-service. */
interface PermissionsByModuleRaw {
  modules: { module: string; permissions: PermissionSummary[] }[];
  total: number;
}

export interface UserAdminItem {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  banned: boolean;
  status: 'ACTIVE' | 'INACTIVE' | string;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface PaginatedUsers {
  items: UserAdminItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function listRoles(accessToken?: string): Promise<ApiResult<RoleResponse[]>> {
  return request<RoleResponse[]>('/roles', { accessToken });
}

export async function getRole(
  id: string,
  accessToken?: string,
): Promise<ApiResult<RoleResponse>> {
  return request<RoleResponse>(`/roles/${encodeURIComponent(id)}`, { accessToken });
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  requireEmailVerified?: boolean;
  require2FA?: boolean;
  permissionIds?: string[];
}

export async function createRole(
  input: CreateRoleInput,
  accessToken?: string,
): Promise<ApiResult<RoleResponse>> {
  return request<RoleResponse>('/roles', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function updateRole(
  id: string,
  input: Partial<CreateRoleInput>,
  accessToken?: string,
): Promise<ApiResult<RoleResponse>> {
  return request<RoleResponse>(`/roles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    accessToken,
  });
}

export async function deleteRole(
  id: string,
  accessToken?: string,
): Promise<ApiResult<void>> {
  return request<void>(`/roles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    accessToken,
  });
}

export async function assignRoleToUser(
  roleId: string,
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/roles/${encodeURIComponent(roleId)}/assign/${encodeURIComponent(userId)}`, {
    method: 'POST',
    accessToken,
  });
}

export async function unassignRoleFromUser(
  roleId: string,
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/roles/${encodeURIComponent(roleId)}/unassign/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function listPermissions(
  accessToken?: string,
): Promise<ApiResult<PermissionsByModuleResponse>> {
  const result = await request<PermissionsByModuleRaw>('/permissions', { accessToken });
  if (!result.ok) return result as unknown as ApiResult<PermissionsByModuleResponse>;

  const raw = result.data as PermissionsByModuleRaw;
  const grouped: PermissionsByModuleResponse = {};
  for (const entry of raw.modules ?? []) {
    grouped[entry.module] = entry.permissions;
  }
  return { ok: true, status: result.status, data: grouped };
}

export async function grantPermissionToUser(
  userId: string,
  permissionId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/permissions/user/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: { permissionId },
    accessToken,
  });
}

export async function revokePermissionFromUser(
  userId: string,
  permissionId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(
    `/permissions/user/${encodeURIComponent(userId)}/${encodeURIComponent(permissionId)}`,
    { method: 'DELETE', accessToken },
  );
}

// ---------------------------------------------------------------------------
// Users (via auth-service /users — admin route)
// ---------------------------------------------------------------------------

export interface ListUsersFilters {
  q?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}

export async function listUsers(
  filters: ListUsersFilters = {},
  accessToken?: string,
): Promise<ApiResult<PaginatedUsers>> {
  return request<PaginatedUsers>('/users', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function banUser(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/ban`, {
    method: 'POST',
    accessToken,
  });
}

export async function unbanUser(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/unban`, {
    method: 'POST',
    accessToken,
  });
}

export async function suspendUser(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/suspend`, {
    method: 'POST',
    accessToken,
  });
}

export async function activateUser(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/activate`, {
    method: 'POST',
    accessToken,
  });
}

export async function disable2FA(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/disable-2fa`, {
    method: 'POST',
    accessToken,
  });
}

export async function revokeSessions(
  userId: string,
  accessToken?: string,
): Promise<ApiResult<unknown>> {
  return request<unknown>(`/users/${encodeURIComponent(userId)}/revoke-sessions`, {
    method: 'POST',
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------

export interface CompanySettings {
  name: string;
  cnpj: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  paymentStreet: string | null;
  paymentNumber: string | null;
  paymentComplement: string | null;
  paymentNeighborhood: string | null;
  paymentCity: string | null;
  paymentState: string | null;
  paymentZip: string | null;
  logoKey: string | null;
  invoiceFooter: string | null;
}

export async function getCompanySettings(
  accessToken?: string,
): Promise<ApiResult<CompanySettings>> {
  return request<CompanySettings>('/company/settings', { accessToken });
}

/**
 * Fetches company settings for public pages (no user session required).
 * Uses the AUTH_INTERNAL_SECRET service-to-service header.
 * Falls back to null if the service is unavailable or not configured.
 */
export async function getPublicCompanySettings(): Promise<CompanySettings | null> {
  const secret = process.env.AUTH_INTERNAL_SECRET;
  if (!secret) return null;
  try {
    const url = `${getAuthServiceUrl()}/company/settings`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      next: { revalidate: 300 }, // cache 5 min — public pages don't need real-time data
    });
    if (!res.ok) return null;
    return (await res.json()) as CompanySettings;
  } catch {
    return null;
  }
}

export async function updateCompanySettings(
  data: Partial<CompanySettings>,
  accessToken?: string,
): Promise<ApiResult<CompanySettings>> {
  return request<CompanySettings>('/company/settings', {
    method: 'PUT',
    body: data,
    accessToken,
  });
}
