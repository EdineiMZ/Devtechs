import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { devFetch } from '@/lib/developer-api';

/**
 * Server-side proxy for VPS actuator + read endpoints.
 *
 * Why route through Next: the developer-service requires a Bearer token,
 * and we never want to ship the token (or even the access cookie) to the
 * browser. The page calls `/api/admin/vps/<id>/<action>` from a client
 * component; this route resolves the session server-side, attaches the
 * Bearer header via `devFetch`, and forwards the result.
 *
 * Allowed `action` values:
 *   POST  start | stop | restart | snapshots
 *   GET   actions | snapshots | metrics | backups
 *
 * Anything else returns 404 to avoid acting as an open relay.
 */

const POST_ACTIONS = new Set(['start', 'stop', 'restart', 'snapshots', 'reinstall']);
const GET_ACTIONS = new Set(['actions', 'snapshots', 'metrics', 'backups', 'ptr']);
const PUT_ACTIONS = new Set(['ptr']);

async function gatekeep(): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, status: 401, message: 'unauthenticated' };
  if (!session.user.permissions.includes('dev:vps:manage')) {
    return { ok: false, status: 403, message: 'missing dev:vps:manage' };
  }
  return { ok: true };
}

export async function POST(
  req: Request,
  ctx: { params: { id: string; action: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  if (!POST_ACTIONS.has(ctx.params.action)) {
    return NextResponse.json({ message: 'unknown action' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const r = await devFetch(`/vps/${ctx.params.id}/${ctx.params.action}`, {
    method: 'POST',
    body,
  });
  return NextResponse.json(r.data, { status: r.status });
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string; action: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  if (!GET_ACTIONS.has(ctx.params.action)) {
    return NextResponse.json({ message: 'unknown action' }, { status: 404 });
  }
  const r = await devFetch(`/vps/${ctx.params.id}/${ctx.params.action}`);
  return NextResponse.json(r.data, { status: r.status });
}

export async function PUT(
  req: Request,
  ctx: { params: { id: string; action: string } },
): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) return NextResponse.json({ message: guard.message }, { status: guard.status });
  if (!PUT_ACTIONS.has(ctx.params.action)) {
    return NextResponse.json({ message: 'unknown action' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const r = await devFetch(`/vps/${ctx.params.id}/${ctx.params.action}`, {
    method: 'PUT',
    body,
  });
  return NextResponse.json(r.data, { status: r.status });
}
