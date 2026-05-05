import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { authServiceFetch } from '@/lib/auth-service';

import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Redefinir senha | SZDevs',
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

async function getTokenInfo(token: string) {
  const res = await authServiceFetch<{
    valid: boolean;
    requires2FA: boolean;
    expiresAt: string;
  }>(/auth/reset-password/info?token=, {
    method: 'GET',
  });
  if (!res.ok) return null;
  return res.data as { valid: boolean; requires2FA: boolean; expiresAt: string };
}

export default async function RedefinirSenhaPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const token = params.token ?? '';

  if (!token) {
    redirect('/esqueci-a-senha');
  }

  const info = await getTokenInfo(token);

  if (!info || !info.valid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <span className="text-2xl font-bold tracking-tight">SZDevs</span>
            </Link>
            <h1 className="mt-6 text-2xl font-bold tracking-tight">Link invalido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link de redefinicao e invalido ou expirou.
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-secondary/20 p-8 shadow-sm text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Solicite um novo link de redefinicao de senha.
            </p>
            <Link
              href="/esqueci-a-senha"
              className="inline-block text-sm font-medium text-copper/80 hover:text-copper underline-offset-4 hover:underline"
            >
              Solicitar novo link
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold tracking-tight">SZDevs</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Nova senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha uma nova senha para sua conta.
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-secondary/20 p-8 shadow-sm">
          <ResetPasswordForm token={token} requires2FA={info.requires2FA} />
        </div>
      </div>
    </main>
  );
}