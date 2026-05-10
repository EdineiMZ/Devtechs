import { auth } from '@/auth';
import { updateProfile } from '@/lib/account-api';

/**
 * Client-callable proxy for `PATCH /auth/me` — the client component
 * fetches via `/api/account/profile`, this route reads the NextAuth
 * session, attaches the bearer, and forwards. Keeps the access token
 * server-side only.
 */
export async function PATCH(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const patch = (await req.json().catch(() => ({}))) as {
    name?: string;
    avatarUrl?: string | null;
  };

  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
  const res = await updateProfile(patch, session.accessToken, ip);
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
