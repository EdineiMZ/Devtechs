import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Esqueci minha senha | SZDevs',
};

export default function EsqueciASenhaPage(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold tracking-tight">SZDevs</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Esqueci minha senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-secondary/20 p-8 shadow-sm">
          <ForgotPasswordForm />
        </div>
        <p className="text-center text-sm text-ash">
          Lembrou a senha?{' '}
          <Link href="/login" className="font-medium text-copper/80 hover:text-copper underline-offset-4 hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </main>
  );
}