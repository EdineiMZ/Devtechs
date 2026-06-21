import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAgrivorServiceUrl } from '@/lib/agrivor-api';

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('agrivor:admin:view')) {
    return NextResponse.json({ message: 'missing agrivor:admin:view' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const upstream = `${getAgrivorServiceUrl()}/api/admin/agrivor/keys/issue`;
  const r = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken ?? ''}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
  });
}
