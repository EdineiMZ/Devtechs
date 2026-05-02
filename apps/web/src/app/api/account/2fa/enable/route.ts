import { auth } from '@/auth';
import { enable2FA } from '@/lib/account-api';

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!body.code) {
    return new Response(
      JSON.stringify({ message: 'code é obrigatório' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const res = await enable2FA(body.code, session.accessToken);
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
