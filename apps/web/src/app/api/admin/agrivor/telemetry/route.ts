import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAgrivorServiceUrl } from '@/lib/agrivor-api';

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('agrivor:admin:view')) {
    return NextResponse.json({ message: 'missing agrivor:admin:view' }, { status: 403 });
  }

  const url = new URL(req.url);
  const upstream = `${getAgrivorServiceUrl()}/api/admin/agrivor/telemetry${url.search}`;
  const r = await fetch(upstream, {
    headers: { Authorization: `Bearer ${session.accessToken ?? ''}` },
    cache: 'no-store',
  });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
  });
}
