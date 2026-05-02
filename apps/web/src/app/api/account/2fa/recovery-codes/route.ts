import { auth } from '@/auth';
import { regenerateRecoveryCodes } from '@/lib/account-api';

export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await regenerateRecoveryCodes(session.accessToken);
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
