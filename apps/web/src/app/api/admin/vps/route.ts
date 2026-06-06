import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { devFetch } from '@/lib/developer-api';

/**
 * Server-side proxy for `POST /vps` (attach a Hostinger VPS) and
 * `GET /vps` (list attached VPS instances).
 *
 * Browser code MUST hit this route instead of calling developer-service
 * directly: in production developer-service lives on the internal
 * docker network (`http://developer-service:3010`) which the browser
 * cannot resolve, and the Bearer token would have to be exposed to the
 * client otherwise. This handler runs server-side, pulls the access
 * token from the NextAuth session, and forwards via `devFetch`.
 */

async function gatekeep(): Promise<
  { ok: true } | { ok: false; status: number; message: string }
> {
  const session = await auth();
  if (!session?.user)
    return { ok: false, status: 401, message: 'unauthenticated' };
  if (!session.user.permissions.includes('dev:vps:manage')) {
    return { ok: false, status: 403, message: 'missing dev:vps:manage' };
  }
  return { ok: true };
}

export async function POST(req: Request): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) {
    return NextResponse.json(
      { message: guard.message },
      { status: guard.status },
    );
  }
  const body = await req.json().catch(() => ({}));
  const r = await devFetch('/vps', { method: 'POST', body });
  return NextResponse.json(r.data, { status: r.status });
}

export async function GET(): Promise<Response> {
  const guard = await gatekeep();
  if (!guard.ok) {
    return NextResponse.json(
      { message: guard.message },
      { status: guard.status },
    );
  }
  const r = await devFetch('/vps');
  return NextResponse.json(r.data, { status: r.status });
}
