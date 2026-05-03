import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthLayout } from '@/components/auth/auth-layout';

import { LoginForm } from './login-form';

/**
 * Server shell for the /login page. Dynamic because the form reads
 * `searchParams` (callbackUrl / error), but the shell itself is
 * trivially pre-renderable so the visible paint is instant and the
 * hydrated form island takes over for the state/logic.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entrar',
  description:
    'Acesse a plataforma SZDevs. Use email e senha, Google ou GitHub.',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false },
};

export default function LoginPage(): JSX.Element {
  return (
    <AuthLayout
      title="Bem-vindo de volta"
      description="Entre na sua conta para continuar"
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link
            href="/register"
            className="font-medium text-copper underline-offset-4 hover:underline"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}

/**
 * Skeleton shown during streaming hydration. Kept minimal so it
 * swaps cleanly into the real form without layout shift.
 */
function LoginFormFallback(): JSX.Element {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/40" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/40" />
      <div className="h-11 w-full animate-pulse rounded-md bg-primary/30" />
    </div>
  );
}
