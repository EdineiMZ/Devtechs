'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createRole } from '@/lib/auth-admin-api';
import type { PermissionsByModuleResponse } from '@/lib/auth-admin-api';

const schema = z.object({
  name: z
    .string()
    .min(2, 'Nome obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  requireEmailVerified: z.boolean().optional(),
  require2FA: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  permsByModule: PermissionsByModuleResponse;
  accessToken: string;
}

export function RoleForm({ permsByModule, accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function togglePerm(permId: string) {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  }

  async function onSubmit(data: FormData) {
    setServerError(null);
    const res = await createRole(
      { ...data, permissionIds: selectedPerms },
      accessToken,
    );
    if (res.ok) {
      router.push('/admin/configuracoes/papeis');
      router.refresh();
    } else {
      const err = res.data as { message?: string | string[] };
      setServerError(
        Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao criar papel.'),
      );
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border border-white/8 bg-white/[0.02] p-5"
    >
      <h3 className="mb-4 text-sm font-semibold text-foreground">Novo papel</h3>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Nome (slug) *</label>
          <input {...register('name')} placeholder="suporte-agent" className={inputCls} />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </div>

        <div>
          <label className={labelCls}>Descrição</label>
          <textarea {...register('description')} rows={2} className={inputCls} />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-ash">
            <input type="checkbox" {...register('requireEmailVerified')} />
            Requer e-mail verificado
          </label>
          <label className="flex items-center gap-2 text-xs text-ash">
            <input type="checkbox" {...register('require2FA')} />
            Requer 2FA
          </label>
        </div>

        {/* Permissions */}
        {Object.keys(permsByModule).length > 0 && (
          <div>
            <p className={labelCls}>Permissões ({selectedPerms.length} selecionadas)</p>
            <div className="max-h-60 overflow-y-auto rounded-md border border-white/8 bg-background p-3">
              {Object.entries(permsByModule).map(([module, perms]) => (
                <div key={module} className="mb-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ash">
                    {module}
                  </p>
                  <div className="space-y-1">
                    {perms.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPerms.includes(p.id)}
                          onChange={() => togglePerm(p.id)}
                        />
                        <span className="font-mono text-[10px] text-ash">
                          {p.key}
                        </span>
                        <span className="text-foreground">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {serverError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Criando…' : 'Criar papel'}
        </button>
      </div>
    </form>
  );
}
