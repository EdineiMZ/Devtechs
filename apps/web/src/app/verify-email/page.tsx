import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthLayout } from '@/components/auth/auth-layout';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirmação de email',
  robots: { index: false, follow: false },
};

interface VerifyEmailPageProps {
  searchParams: { token?: string };
}

interface VerifyResult {
  ok: boolean;
  status: 'success' | 'invalid' | 'expired' | 'error';
  message: string;
}

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Resolve the auth-service base URL we should hit to verify the token.
 *
 * In production the auth-service lives on the internal docker network
 * (`http://auth-service:3001`). In dev it usually runs on
 * `http://localhost:3001`. We never want to use a public URL here —
 * this code runs server-side, the user already trusted us with their
 * click, and the verification call is one-shot.
 */
function getAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ??
    'http://auth-service:3001'
  );
}

async function verifyToken(token: string): Promise<VerifyResult> {
  if (!TOKEN_PATTERN.test(token)) {
    return {
      ok: false,
      status: 'invalid',
      message: 'O link de verificação está malformado.',
    };
  }

  const url = `${getAuthServiceUrl()}/auth/email/verify?token=${encodeURIComponent(token)}`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', cache: 'no-store' });
  } catch {
    return {
      ok: false,
      status: 'error',
      message: 'Não foi possível contatar o servidor de autenticação.',
    };
  }

  let payload: { message?: string; error?: string } = {};
  try {
    payload = (await res.json()) as { message?: string; error?: string };
  } catch {
    /* keep payload empty */
  }

  if (res.ok) {
    return {
      ok: true,
      status: 'success',
      message: 'Email confirmado com sucesso. Você já pode acessar sua conta.',
    };
  }
  if (res.status === 410 || res.status === 404) {
    return {
      ok: false,
      status: 'expired',
      message:
        payload.message ??
        'O link de verificação expirou ou já foi utilizado. Solicite um novo email pela página de perfil.',
    };
  }
  if (res.status === 400) {
    return {
      ok: false,
      status: 'invalid',
      message:
        payload.message ?? 'Token de verificação inválido ou já usado.',
    };
  }
  return {
    ok: false,
    status: 'error',
    message:
      payload.message ??
      'Não foi possível confirmar o email. Tente novamente em instantes.',
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps): Promise<JSX.Element> {
  const token = (searchParams.token ?? '').trim();

  const result: VerifyResult = token
    ? await verifyToken(token)
    : {
        ok: false,
        status: 'invalid',
        message:
          'Link de verificação incompleto. Use o botão dentro do email recebido.',
      };

  return (
    <AuthLayout
      title={result.ok ? 'Email confirmado' : 'Não foi possível confirmar'}
      description={
        result.ok
          ? 'Sua conta está pronta para uso.'
          : 'Algo deu errado com o link de verificação.'
      }
    >
      <div className="space-y-6">
        <div
          aria-hidden="true"
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-1 ${
            result.ok
              ? 'bg-emerald-500/10 ring-emerald-500/30'
              : 'bg-amber-500/10 ring-amber-500/30'
          }`}
        >
          {result.ok ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-emerald-400"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-amber-400"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          )}
        </div>

        <p className="text-center text-sm text-ash">{result.message}</p>

        <div className="flex flex-col gap-2">
          {result.ok ? (
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Entrar agora
            </Link>
          ) : (
            <>
              <Link
                href="/perfil"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Ir para o perfil
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
              >
                Fazer login
              </Link>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
