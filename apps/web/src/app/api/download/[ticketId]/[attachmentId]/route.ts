import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';

const SUPPORT_SERVICE_URL =
  process.env.SUPPORT_SERVICE_URL ??
  process.env.NEXT_PUBLIC_SUPPORT_URL ??
  process.env.NEXT_PUBLIC_SUPPORT_SERVICE_URL ??
  'http://127.0.0.1:4008';

/**
 * Authenticated proxy for ticket attachment downloads.
 *
 * The browser's <a href> cannot set an Authorization header, and the
 * nginx location /api/support/ routes directly to the support-service
 * (bypassing Next.js). This route lives under /api/download/ — a path
 * nginx forwards to the web app — so auth() can read the session and
 * add the bearer token before forwarding to the support-service.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string; attachmentId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    // Use the forwarded host so the redirect points to the public domain,
    // not the internal container address that _req.url resolves to.
    const host =
      _req.headers.get('x-forwarded-host') ??
      _req.headers.get('host') ??
      'localhost';
    const proto = _req.headers.get('x-forwarded-proto') ?? 'https';
    const loginUrl = `${proto}://${host}/login`;
    return NextResponse.redirect(loginUrl);
  }

  const { ticketId, attachmentId } = await params;

  const upstream = `${SUPPORT_SERVICE_URL}/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ message: 'support-service indisponível' }, { status: 503 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return NextResponse.json({ message: body || 'Erro ao obter arquivo' }, { status: res.status });
  }

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const disposition = res.headers.get('content-disposition') ?? '';
  const blob = await res.arrayBuffer();

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      ...(disposition ? { 'Content-Disposition': disposition } : {}),
      'Cache-Control': 'private, no-store',
    },
  });
}
