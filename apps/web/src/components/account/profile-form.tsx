'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button, Input } from '@devtechs/ui';

import {
  profileSchema,
  type ProfileFormValues,
} from '@/lib/account-schemas';

interface ProfileFormProps {
  initial: { name: string; email: string; avatarUrl: string | null };
  emailVerified: boolean;
}

/**
 * "Perfil" form — name (editable), email (read-only), avatar URL.
 *
 * Submit hits `PATCH /api/account/profile` (the Next route that
 * proxies to auth-service `PATCH /auth/me`). On success we call
 * `useSession().update()` so the topbar's avatar/name reflect the
 * new value without a hard refresh.
 */
export function ProfileForm({
  initial,
  emailVerified,
}: ProfileFormProps): JSX.Element {
  const { update } = useSession();
  const [banner, setBanner] = useState<
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initial.name,
      avatarUrl: initial.avatarUrl ?? undefined,
    },
  });

  async function onSubmit(values: ProfileFormValues): Promise<void> {
    setBanner(null);
    const payload: { name: string; avatarUrl?: string | null } = {
      name: values.name.trim(),
      avatarUrl: values.avatarUrl ?? null,
    };

    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Não foi possível atualizar o perfil.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setBanner({ kind: 'error', message: msg });
      return;
    }

    const updated = (await res.json()) as {
      name: string;
      avatarUrl: string | null;
    };
    setBanner({ kind: 'success', message: 'Perfil atualizado com sucesso.' });
    reset({
      name: updated.name,
      avatarUrl: updated.avatarUrl ?? undefined,
    });
    // Refresh NextAuth's in-memory JWT so other components (e.g. the
    // topbar avatar initials) reflect the new name immediately.
    try {
      await update({ name: updated.name });
    } catch {
      /* not fatal — the next page load will pick up the new name */
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-6"
      aria-describedby={banner ? 'profile-form-banner' : undefined}
    >
      <Input
        label="Nome"
        type="text"
        autoComplete="name"
        maxLength={120}
        error={errors.name?.message}
        {...register('name')}
      />

      <Input
        label="E-mail"
        type="email"
        value={initial.email}
        readOnly
        disabled
        hint={
          emailVerified
            ? 'Seu e-mail está verificado.'
            : 'E-mail ainda não verificado.'
        }
      />

      <Input
        label="URL do avatar (opcional)"
        type="url"
        autoComplete="off"
        placeholder="https://exemplo.com/avatar.png"
        error={errors.avatarUrl?.message}
        hint="Cole a URL completa de uma imagem pública. Deixe vazio para usar suas iniciais."
        {...register('avatarUrl')}
      />

      {banner ? (
        <div
          id="profile-form-banner"
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}
        >
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
