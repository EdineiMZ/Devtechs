import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAuthServiceUrl } from '@/lib/auth-service';

/**
 * Proxy `GET /api/admin/users/:id/sessions` → `auth-service
 * /admin/users/:id/sessions`. Used by the user activity panel's
 * "Sessões ativas" widget.
 *
 * Permission gate happens server-side in auth-service — but we
 * short-circuit with the same `dev:logs:view` check so the network
 * round-trip is skipped on obvious forbidden cases.
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('dev:logs:view')) {
    return NextResponse.json({ message: 'missing dev:logs:view' }, { status: 403 });
  }

  const upstream = `${getAuthServiceUrl()}/admin/users/${encodeURIComponent(ctx.params.id)}/sessions`;
  const r = await fetch(upstream, {
    headers: { Authorization: `Bearer ${session.accessToken ?? ''}` },
    cache: 'no-store',
  });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
  });
}
