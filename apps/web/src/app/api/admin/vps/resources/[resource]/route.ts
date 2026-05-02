import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { devFetch } from '@/lib/developer-api';

/**
 * Proxy for account-level Hostinger resources that are not tied to a
 * specific VM:  ssh-keys | os-templates | firewall
 *
 * GET /api/admin/vps/resources/ssh-keys
 * GET /api/admin/vps/resources/os-templates
 * GET /api/admin/vps/resources/firewall
 */

const ALLOWED = new Set(['ssh-keys', 'os-templates', 'firewall']);

async function gatekeep(): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, message: 'unauthenticated' };
  if (!session.user.permissions.includes('dev:vps:manage')) {
    return { ok: false, status: 403, message: 'missing dev:vps:manage' };
  }
  return { ok: true };
}

export async function GET(
  _req: Request,
  ctx: { params: { resource: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  if (!ALLOWED.has(ctx.params.resource)) {
    return NextResponse.json({ message: 'unknown resource' }, { status: 404 });
  }
  const r = await devFetch(`/vps/resources/${ctx.params.resource}`);
  return NextResponse.json(r.data, { status: r.status });
}
