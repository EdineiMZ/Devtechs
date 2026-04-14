'use client';

import Link from 'next/link';

import { Button } from '@devtechs/ui';

/**
 * Post-register success view — shown inline in place of the form
 * once auth-service accepts the registration.
 *
 * The account exists in the database but `emailVerified = false`,
 * so every protected route still gates against the user. We DO NOT
 * auto-sign-in here: keeping the user signed-out until they click
 * the link in the email is a cleaner state machine and matches the
 * common expectation of email verification flows.
 *
 * If they need to resend the verification email, they have to go
 * through /login first — the middleware will then redirect them
 * to /verificar-email where the resend button lives.
 */
interface RegisterSuccessViewProps {
  email: string;
}

export function RegisterSuccessView({ email }: RegisterSuccessViewProps): JSX.Element {
  return (
    <div className="space-y-6 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 text-primary"
        >
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          Verifique seu email
        </h2>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de verificação para{' '}
          <span className="font-medium text-foreground">{email}</span>. Clique
          no link para ativar sua conta e entrar na plataforma.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Não recebeu o email?</p>
        <p className="mt-1">
          Verifique a pasta de spam ou lixo eletrônico. Se ainda não encontrar,
          faça login e use a opção de reenviar verificação.
        </p>
      </div>

      <Button asChild size="lg" className="w-full">
        <Link href="/login">Voltar ao login</Link>
      </Button>
    </div>
  );
}
