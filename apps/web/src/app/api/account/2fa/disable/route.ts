import { auth } from '@/auth';
import { disable2FA } from '@/lib/account-api';

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    code?: string;
  };
  if (!body.currentPassword) {
    return new Response(
      JSON.stringify({ message: 'currentPassword é obrigatório' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const res = await disable2FA(
    { currentPassword: body.currentPassword, code: body.code },
    session.accessToken,
  );
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
