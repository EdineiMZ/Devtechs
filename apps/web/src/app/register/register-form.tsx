'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@devtechs/ui';

import { registerSchema, type RegisterInput } from '@/lib/auth-schemas';
import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

import { RegisterSuccessView } from './register-success-view';

/**
 * Register form → "check your email" success view.
 *
 * We call auth-service `/auth/register` directly rather than going
 * through a Next.js route handler because this flow has no secrets
 * to protect — the backend is already rate-limited by IP and the
 * response body is public-safe. Keeping it direct removes one hop
 * and one file.
 *
 * After a successful register we swap the form out for a dedicated
 * success view (same file, sibling component). The success view
 * carries the email address so it can offer a "voltar para login"
 * link pre-filled with context.
 */

type SubmitStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; email: string; userId: string }
  | { kind: 'error'; message: string };

export function RegisterForm(): JSX.Element {
  const [status, setStatus] = useState<SubmitStatus>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      nome: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setStatus({ kind: 'loading' });
    const res = await authServiceFetch<{ message: string; userId: string }>(
      '/auth/register',
      {
        body: {
          name: data.nome,
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
        },
      },
    );
    if (!res.ok) {
      setStatus({ kind: 'error', message: extractErrorMessage(res.data) });
      return;
    }
    const body = res.data as { message: string; userId: string };
    setStatus({ kind: 'success', email: data.email, userId: body.userId });
  });

  if (status.kind === 'success') {
    return <RegisterSuccessView email={status.email} />;
  }

  const loading = status.kind === 'loading';

  return (
    <div className="space-y-6">
      {status.kind === 'error' ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Não foi possível criar a conta</p>
          <p className="mt-1 opacity-90">{status.message}</p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input
          label="Nome completo"
          placeholder="Como devemos te chamar?"
          autoComplete="name"
          disabled={loading}
          error={errors.nome?.message}
          {...register('nome')}
        />

        <Input
          label="Email"
          type="email"
          placeholder="voce@empresa.com"
          autoComplete="email"
          disabled={loading}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Senha"
          type="password"
          placeholder="Pelo menos 8 caracteres"
          autoComplete="new-password"
          disabled={loading}
          hint="Mínimo 8 caracteres, com ao menos uma maiúscula, uma minúscula e um número."
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirmar senha"
          type="password"
          placeholder="Digite a senha novamente"
          autoComplete="new-password"
          disabled={loading}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {loading ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Ao criar uma conta você concorda com os{' '}
        <Link
          href="/termos"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          termos de uso
        </Link>{' '}
        e a{' '}
        <Link
          href="/privacidade"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          política de privacidade
        </Link>
        .
      </p>
    </div>
  );
}
