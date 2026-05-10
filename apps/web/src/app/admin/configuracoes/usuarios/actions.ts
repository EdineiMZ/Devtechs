'use server';

import { auth } from '@/auth';
import {
  assignRoleToUser,
  unassignRoleFromUser,
  suspendUser,
  activateUser,
  banUser,
  unbanUser,
  disable2FA,
  revokeSessions,
} from '@/lib/auth-admin-api';
import type { ApiResult } from '@/lib/auth-admin-api';

async function requireToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) throw new Error('Sessão expirada. Faça login novamente.');
  return session.accessToken;
}

export async function assignRoleAction(roleId: string, userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return assignRoleToUser(roleId, userId, token);
}

export async function unassignRoleAction(roleId: string, userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return unassignRoleFromUser(roleId, userId, token);
}

export async function suspendUserAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return suspendUser(userId, token);
}

export async function activateUserAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return activateUser(userId, token);
}

export async function banUserAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return banUser(userId, token);
}

export async function unbanUserAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return unbanUser(userId, token);
}

export async function disable2FAAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return disable2FA(userId, token);
}

export async function revokeSessionsAction(userId: string): Promise<ApiResult<unknown>> {
  const token = await requireToken();
  return revokeSessions(userId, token);
}
