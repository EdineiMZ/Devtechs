import { auth } from '@/auth';
import { disable2FAViaEmailOtp } from '@/lib/account-api';

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    emailOtp?: string;
  };
  if (!body.currentPassword || !body.emailOtp) {
    return new Response(
      JSON.stringify({ message: 'currentPassword e emailOtp são obrigatórios' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const res = await disable2FAViaEmailOtp(
    { currentPassword: body.currentPassword, emailOtp: body.emailOtp },
    session.accessToken,
  );
  return new Response(JSON.stringify(res.data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
