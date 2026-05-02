import { auth } from '@/auth';
import { setup2FA } from '@/lib/account-api';

/** `POST /api/account/2fa/setup` → starts the 2FA setup ceremony. */
export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await setup2FA(session.accessToken);
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
