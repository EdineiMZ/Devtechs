'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, Input } from '@szdevs/ui';

import { forgotPasswordAction } from './actions';

const schema = z.object({
  email: z.string().email('Email invalido').max(254),
});
type FormData = z.infer<typeof schema>;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ForgotPasswordForm(): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setState({ kind: 'loading' });
    const result = await forgotPasswordAction(data.email);
    if (!result.ok) {
      setState({ kind: 'error', message: result.error ?? 'Ocorreu um erro inesperado' });
    } else {
      setState({ kind: 'success' });
    }
  });

  if (state.kind === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Verifique seu email</h2>
        <p className="text-sm text-muted-foreground">
          Se o email estiver cadastrado, voce recebera um link de redefinicao em breve. Verifique tambem a caixa de spam.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-copper/80 hover:text-copper underline-offset-4 hover:underline"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {state.kind === 'error' ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com"
        disabled={state.kind === 'loading'}
        error={errors.email?.message}
        {...register('email')}
      />

      <Button
        type="submit"
        variant="copper"
        size="lg"
        className="w-full"
        loading={state.kind === 'loading'}
        disabled={state.kind === 'loading'}
      >
        {state.kind === 'loading' ? 'Enviando...' : 'Enviar link de redefinicao'}
      </Button>
    </form>
  );
}