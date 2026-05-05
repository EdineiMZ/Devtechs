'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button, Input } from '@szdevs/ui';

import { resetPasswordAction } from './actions';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Minimo 8 caracteres')
      .max(128)
      .regex(/(?=.*[a-z])/, 'Pelo menos uma letra minuscula')
      .regex(/(?=.*[A-Z])/, 'Pelo menos uma letra maiuscula')
      .regex(/(?=.*\d)/, 'Pelo menos um numero'),
    confirmPassword: z.string(),
    totpCode: z.string().length(6, 'O codigo deve ter 6 digitos').optional().or(z.literal('')),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas nao coincidem',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  token: string;
  requires2FA: boolean;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function ResetPasswordForm({ token, requires2FA }: Props): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '', totpCode: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setState({ kind: 'loading' });
    const result = await resetPasswordAction(
      token,
      data.newPassword,
      data.confirmPassword,
      data.totpCode || undefined,
    );

    if (result.requires2FA) {
      setState({ kind: 'error', message: 'Informe o codigo do autenticador para confirmar a mudanca.' });
      return;
    }

    if (!result.ok) {
      setState({ kind: 'error', message: result.error ?? 'Ocorreu um erro inesperado' });
      return;
    }

    setState({ kind: 'success' });
    setTimeout(() => router.replace('/login'), 3000);
  });

  if (state.kind === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Senha redefinida!</h2>
        <p className="text-sm text-muted-foreground">
          Sua senha foi alterada com sucesso. Redirecionando para o login...
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-copper/80 hover:text-copper underline-offset-4 hover:underline"
        >
          Ir para o login
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
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        placeholder="Minimo 8 caracteres"
        disabled={state.kind === 'loading'}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <Input
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
        placeholder="Repita a nova senha"
        disabled={state.kind === 'loading'}
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {requires2FA ? (
        <div className="space-y-1">
          <Input
            label="Codigo do autenticador"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            disabled={state.kind === 'loading'}
            hint="6 digitos do seu aplicativo autenticador"
            error={errors.totpCode?.message}
            {...register('totpCode')}
          />
          <p className="text-xs text-muted-foreground">
            Sua conta tem verificacao em duas etapas. Informe o codigo atual para confirmar a mudanca de senha.
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        variant="copper"
        size="lg"
        className="w-full"
        loading={state.kind === 'loading'}
        disabled={state.kind === 'loading'}
      >
        {state.kind === 'loading' ? 'Salvando...' : 'Redefinir senha'}
      </Button>
    </form>
  );
}