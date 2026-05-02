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

/** POST /api/admin/vps/[id]/backups/[backupId]/restore */
export async function POST(
  _req: Request,
  ctx: { params: { id: string; backupId: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  const r = await devFetch(
    `/vps/${ctx.params.id}/backups/${ctx.params.backupId}/restore`,
    { method: 'POST' },
  );
  return NextResponse.json(r.data, { status: r.status });
}
