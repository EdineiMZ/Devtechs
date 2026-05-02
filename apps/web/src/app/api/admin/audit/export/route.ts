import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getAuthServiceUrl } from '@/lib/auth-service';

/**
 * Streams the audit CSV from auth-service through the Next route.
 * The browser hits `/api/admin/audit/export?dateFrom=…&dateTo=…` and
 * gets a `Content-Disposition: attachment` response, never seeing the
 * Bearer token.
 *
 * The body is streamed as-is (no JSON parsing) so a 50k-row export
 * doesn't pin the Node heap.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ message: 'unauthenticated' }, { status: 401 });
  if (!session.user.permissions.includes('dev:logs:view')) {
    return NextResponse.json({ message: 'missing dev:logs:view' }, { status: 403 });
  }

  const url = new URL(req.url);
  const upstream = `${getAuthServiceUrl()}/audit/logs/export${url.search}`;
  const r = await fetch(upstream, {
    headers: { Authorization: `Bearer ${session.accessToken ?? ''}` },
    cache: 'no-store',
  });

  if (!r.ok) {
    return new NextResponse(await r.text(), {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const disposition =
    r.headers.get('Content-Disposition') ?? 'attachment; filename="audit-logs.csv"';
  return new NextResponse(r.body, {
    status: 200,
    headers: {
      'Content-Type': r.headers.get('Content-Type') ?? 'text/csv; charset=utf-8',
      'Content-Disposition': disposition,
    },
  });
}
