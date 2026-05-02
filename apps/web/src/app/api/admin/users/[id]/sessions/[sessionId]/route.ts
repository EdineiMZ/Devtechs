import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAuthServiceUrl } from '@/lib/auth-service';

/**
 * Proxy `DELETE /api/admin/users/:id/sessions/:sessionId` →
 * `auth-service /admin/users/:id/sessions/:sessionId`.
 *
 * Soft-revokes the session (auth-service sets `revokedAt`). Requires
 * `auth:users:manage`; we mirror the check up here so a user without
 * the permission is rejected before the token leaves the box.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: { id: string; sessionId: string } },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('auth:users:manage')) {
    return NextResponse.json({ message: 'missing auth:users:manage' }, { status: 403 });
  }

  const upstream =
    `${getAuthServiceUrl()}/admin/users/${encodeURIComponent(ctx.params.id)}` +
    `/sessions/${encodeURIComponent(ctx.params.sessionId)}`;
  const r = await fetch(upstream, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.accessToken ?? ''}` },
    cache: 'no-store',
  });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
  });
}
