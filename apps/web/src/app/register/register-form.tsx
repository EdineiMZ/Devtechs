'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Input } from '@szdevs/ui';

import { registerSchema, type RegisterInput } from '@/lib/auth-schemas';
import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

import { RegisterSuccessView } from './register-success-view';

/**
 * Register form → "check your email" success view.
 *
 * Includes an explicit opt-in checkbox required by LGPD art. 7º, I:
 * "manifestação livre, informada e inequívoca" do titular antes do
 * tratamento dos dados. O simples texto passivo não é suficiente.
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
      // termsAccepted starts as undefined (falsy) — checkbox unchecked
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

        {/* ── Consentimento explícito — LGPD art. 7º, I ─────────────── */}
        <div className="space-y-1">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              disabled={loading}
              className={[
                'mt-0.5 h-4 w-4 shrink-0 rounded border appearance-none',
                'bg-white/[0.03] border-white/20',
                'checked:bg-copper checked:border-copper',
                'focus:outline-none focus:ring-1 focus:ring-copper/40',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors cursor-pointer',
              ].join(' ')}
              aria-required="true"
              {...register('termsAccepted')}
            />
            <span className="text-xs text-ash leading-relaxed group-has-[:disabled]:opacity-50">
              Li e aceito os{' '}
              <Link
                href="/termos"
                target="_blank"
                className="font-medium text-copper/80 underline-offset-4 hover:text-copper"
              >
                termos de uso
              </Link>{' '}
              e a{' '}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-medium text-copper/80 underline-offset-4 hover:text-copper"
              >
                política de privacidade
              </Link>
              , incluindo o tratamento dos meus dados pessoais conforme descrito.
            </span>
          </label>

          {errors.termsAccepted ? (
            <p role="alert" className="text-xs text-red-400 pl-7">
              {errors.termsAccepted.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="copper" size="lg" className="w-full" loading={loading}>
          {loading ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
    </div>
  );
}
