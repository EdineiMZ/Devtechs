import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@szdevs/ui';
import { AuthLayout } from '@/components/auth/auth-layout';

import { validateResetToken } from './actions';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Redefinir senha',
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: { token?: string; email?: string };
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps): Promise<JSX.Element> {
  const { token, email } = searchParams;

  if (!token || !email) {
    return (
      <AuthLayout
        title="Link inválido"
        description="Este link de redefinição é inválido ou incompleto."
        footer={
          <Link href="/login" className="font-medium text-copper underline-offset-4 hover:underline">
            ← Voltar ao login
          </Link>
        }
      >
        <div className="space-y-4">
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Link inválido ou incompleto</p>
            <p className="mt-1 opacity-90">Solicite um novo link para continuar com segurança.</p>
          </div>
          <Link href="/forgot-password">
            <Button variant="copper" size="lg" className="w-full">
              Solicitar novo link
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const validation = await validateResetToken(token, email);

  if ('error' in validation) {
    const forgotHref = `/forgot-password?email=${encodeURIComponent(email)}`;
    return (
      <AuthLayout
        title="Link expirado"
        description="Este link de redefinição expirou ou já foi utilizado."
        footer={
          <Link href="/login" className="font-medium text-copper underline-offset-4 hover:underline">
            ← Voltar ao login
          </Link>
        }
      >
        <div className="space-y-4">
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-semibold">Link expirado ou inválido</p>
            <p className="mt-1 opacity-90">Links de redefinição expiram em 5 minutos. Solicite um novo.</p>
          </div>
          <Link href={forgotHref}>
            <Button variant="copper" size="lg" className="w-full">
              Solicitar novo link
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Definir nova senha"
      description="Proteja seu acesso com uma senha forte."
      footer={
        <Link href="/login" className="font-medium text-copper underline-offset-4 hover:underline">
          ← Voltar ao login
        </Link>
      }
    >
      <ResetPasswordForm token={token} email={email} />
    </AuthLayout>
  );
}
