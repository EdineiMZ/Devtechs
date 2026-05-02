import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { auth } from '@/auth';
import { AuthLayout } from '@/components/auth/auth-layout';

import { TwoFaVerifyForm } from './two-fa-verify-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificação em duas etapas',
  robots: { index: false, follow: false },
};

export default async function TwoFaVerificarPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}): Promise<JSX.Element> {
  const session = await auth();

  // Not logged in → send to /login
  if (!session?.user) {
    redirect('/login');
  }

  // 2FA already completed or not enabled → redirect to callbackUrl or /perfil
  if (!session.user.twoFactorEnabled || session.twoFactorCompleted) {
    const target = searchParams.callbackUrl ?? '/perfil';
    redirect(target.startsWith('/') && !target.startsWith('//') ? target : '/perfil');
  }

  const callbackUrl = searchParams.callbackUrl ?? '/admin';

  return (
    <AuthLayout
      title="Verificação em duas etapas"
      description="Confirme sua identidade para acessar esta área"
    >
      <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-muted/30" />}>
        <TwoFaVerifyForm
          callbackUrl={callbackUrl}
          accessToken={session.accessToken}
        />
      </Suspense>
    </AuthLayout>
  );
}
