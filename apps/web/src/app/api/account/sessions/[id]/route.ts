import { auth } from '@/auth';
import { revokeSession } from '@/lib/account-api';

/** `DELETE /api/account/sessions/:id` → forwards to auth-service. */
export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } },
): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await revokeSession(ctx.params.id, session.accessToken);
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
