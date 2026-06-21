import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAgrivorServiceUrl } from '@/lib/agrivor-api';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('agrivor:admin:view')) {
    return NextResponse.json({ message: 'missing agrivor:admin:view' }, { status: 403 });
  }

  const upstream = `${getAgrivorServiceUrl()}/api/m2m/keys/tenants`;
  try {
    const r = await fetch(upstream, {
      headers: { Authorization: `Bearer ${process.env.SZDEVS_M2M_TOKEN ?? ''}` },
      cache: 'no-store',
    });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'M2M service unavailable (WS1 pending)' }, { status: 503 });
  }
}
