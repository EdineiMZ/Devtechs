import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getDeveloperServiceUrl } from '@/lib/developer-api';

/**
 * Catch-all proxy for the developer console.
 *
 * Browser → /admin/developer/api/proxy/<path>
 *   ↓ (server-side, attaches Bearer token from NextAuth session)
 * developer-service → /<path>
 *
 * The browser never sees the backend URL or token directly. The
 * route is gated by the global middleware (`/admin/:path*`) so
 * anonymous requests are bounced before this handler runs, but
 * we still re-check `session.accessToken` here as defense in depth.
 */
async function handler(
  req: Request,
  ctx: { params: { path: string[] } },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const target = `${getDeveloperServiceUrl()}/${ctx.params.path.join('/')}${url.search}`;

  let body: BodyInit | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text();
  }

  const res = await fetch(target, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body,
    cache: 'no-store',
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
    },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
