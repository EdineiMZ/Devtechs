import { auth } from '@/auth';
import { getFinanceServiceUrl } from '@/lib/finance-api';

/**
 * Server-side proxy for `GET /invoices/:id/pdf`.
 *
 * The browser cannot attach an `Authorization` header to a regular
 * `<a href>` download, so we bridge through this route: read the
 * user's session, attach the bearer token, and stream the PDF
 * back. The browser sees a normal binary download with the right
 * `Content-Disposition` filename.
 *
 * Defense-in-depth: even though the parent middleware gates
 * `/perfil/:path*`, we still re-check the session here. A request
 * that bypasses the matcher (Next.js bug, infrastructure mistake)
 * still cannot reach the backend without a valid token.
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const target = `${getFinanceServiceUrl()}/invoices/${encodeURIComponent(ctx.params.id)}/pdf`;
  const upstream = await fetch(target, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new Response(`Upstream error: ${upstream.status}`, {
      status: upstream.status,
    });
  }

  // Pass-through the PDF bytes + headers. We strip everything
  // except the few that matter for the browser.
  const headers = new Headers();
  headers.set(
    'Content-Type',
    upstream.headers.get('Content-Type') ?? 'application/pdf',
  );
  const cd = upstream.headers.get('Content-Disposition');
  if (cd) headers.set('Content-Disposition', cd);
  const len = upstream.headers.get('Content-Length');
  if (len) headers.set('Content-Length', len);

  return new Response(upstream.body, { status: 200, headers });
}
