'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button, Input } from '@szdevs/ui';

import {
  passwordSchema,
  type PasswordFormValues,
} from '@/lib/account-schemas';

/**
 * Password-change form. Posts to `/api/account/password` (Next route
 * proxying to auth-service `POST /auth/me/password`).
 *
 * Backend revokes every other session; on success we additionally
 * call `signOut()` so this browser is forced through `/login` and
 * picks up a fresh JWT — important because the JWT carries the
 * permission set and we don't want any caller to keep the old token
 * floating around in localstorage.
 */
export function ChangePasswordForm(): JSX.Element {
  const [banner, setBanner] = useState<
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: PasswordFormValues): Promise<void> {
    setBanner(null);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Não foi possível alterar a senha.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }

    reset();
    setBanner({
      kind: 'success',
      message: 'Senha alterada com sucesso. Você será redirecionado para o login…',
    });

    // Tiny delay so the user can read the banner before the redirect.
    setTimeout(() => {
      void signOut({ redirectTo: '/login?reason=password_changed' });
    }, 1500);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-6"
      aria-describedby={banner ? 'password-form-banner' : undefined}
    >
      <Input
        label="Senha atual"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <Input
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        hint="Mínimo 8 caracteres com letra maiúscula, minúscula e número."
        {...register('newPassword')}
      />
      <Input
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {banner ? (
        <div
          id="password-form-banner"
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={
            banner.kind === 'success'
              ? 'rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200'
              : 'rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'
          }
        >
          {banner.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Trocar senha
        </Button>
      </div>
    </form>
  );
}
