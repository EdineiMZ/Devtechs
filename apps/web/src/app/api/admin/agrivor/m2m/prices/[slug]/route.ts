import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAgrivorServiceUrl } from '@/lib/agrivor-api';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('agrivor:admin:view')) {
    return NextResponse.json({ message: 'missing agrivor:admin:view' }, { status: 403 });
  }

  const { slug } = await params;
  const upstream = `${getAgrivorServiceUrl()}/api/m2m/prices/${encodeURIComponent(slug)}`;
  try {
    const body = await req.text();
    const r = await fetch(upstream, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.SZDEVS_M2M_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    const resBody = await r.text();
    return new NextResponse(resBody, {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'M2M service unavailable' }, { status: 503 });
  }
}
