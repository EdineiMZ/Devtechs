import { auth } from '@/auth';
import { changePassword } from '@/lib/account-api';

/**
 * `POST /api/account/password` → forwards to auth-service `POST /auth/me/password`.
 * The client posts `{ currentPassword, newPassword }`. On success the client
 * is responsible for calling `signOut()` because the auth-service revokes
 * every other session.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!body.currentPassword || !body.newPassword) {
    return new Response(
      JSON.stringify({ message: 'currentPassword e newPassword são obrigatórios' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const res = await changePassword(
    { currentPassword: body.currentPassword, newPassword: body.newPassword },
    session.accessToken,
    ip,
  );
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
