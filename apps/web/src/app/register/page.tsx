import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthLayout } from '@/components/auth/auth-layout';

import { RegisterForm } from './register-form';

export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Criar conta',
  description:
    'Crie sua conta DevTechs e comece a usar nossa plataforma de projetos, DevOps e suporte.',
  alternates: { canonical: '/register' },
  robots: { index: false, follow: false },
};

export default function RegisterPage(): JSX.Element {
  return (
    <AuthLayout
      title="Crie sua conta"
      description="Em menos de um minuto você tem acesso à plataforma"
      footer={
        <>
          Já tem conta?{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
