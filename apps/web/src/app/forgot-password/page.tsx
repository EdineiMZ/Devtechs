import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthLayout } from '@/components/auth/auth-layout';

import { ForgotPasswordForm } from './forgot-password-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recuperar acesso',
  description: 'Solicite um link seguro para redefinir sua senha no SZDevs.',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage(): JSX.Element {
  return (
    <AuthLayout
      title="Recuperar acesso"
      description="Enviaremos um link seguro para redefinir sua senha."
      footer={
        <Link
          href="/login"
          className="font-medium text-copper underline-offset-4 hover:underline"
        >
          ← Voltar ao login
        </Link>
      }
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
