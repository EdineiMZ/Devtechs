import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { devFetch } from '@/lib/developer-api';

async function gatekeep(): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, message: 'unauthenticated' };
  if (!session.user.permissions.includes('dev:vps:manage')) {
    return { ok: false, status: 403, message: 'missing dev:vps:manage' };
  }
  return { ok: true };
}

/** DELETE /api/admin/vps/[id]/snapshots/[snapshotId] */
export async function DELETE(
  _req: Request,
  ctx: { params: { id: string; snapshotId: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  const r = await devFetch(`/vps/${ctx.params.id}/snapshots/${ctx.params.snapshotId}`, {
    method: 'DELETE',
  });
  return NextResponse.json(r.data, { status: r.status });
}
