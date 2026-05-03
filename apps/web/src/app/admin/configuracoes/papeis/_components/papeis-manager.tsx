'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createRole, updateRole, deleteRole } from '@/lib/auth-admin-api';
import type { PermissionsByModuleResponse, RoleResponse } from '@/lib/auth-admin-api';

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
  initial: RoleResponse[];
  permsByModule: PermissionsByModuleResponse;
  accessToken: string;
}

export function PapeisManager({ initial, permsByModule, accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleResponse[]>(initial);
  const [editing, setEditing] = useState<RoleResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function startCreate() {
    setEditing(null);
    setSelectedPerms([]);
    reset({ name: '', description: '', requireEmailVerified: false, require2FA: false });
    setShowForm(true);
  }

  function startEdit(role: RoleResponse) {
    setEditing(role);
    setSelectedPerms(role.permissions.map((p) => p.id));
    reset({
      name: role.name,
      description: role.description ?? '',
      requireEmailVerified: role.requireEmailVerified,
      require2FA: role.require2FA,
    });
    setShowForm(true);
  }

  function togglePerm(permId: string) {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    );
  }

  async function onSubmit(data: FormData) {
    setServerError(null);
    const payload = { ...data, permissionIds: selectedPerms };
    const res = editing
      ? await updateRole(editing.id, payload, accessToken)
      : await createRole(payload, accessToken);

    if (res.ok) {
      const updated = res.data as RoleResponse;
      if (editing) {
        setRoles((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
      } else {
        setRoles((prev) => [...prev, updated]);
      }
      setShowForm(false);
      router.refresh();
    } else {
      const err = res.data as { message?: string | string[] };
      setServerError(
        Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao salvar papel.'),
      );
    }
  }

  async function handleDelete(role: RoleResponse) {
    if (role.isSystem) {
      alert('Papéis de sistema não podem ser excluídos.');
      return;
    }
    if (!confirm(`Excluir o papel "${role.name}"? Usuários com este papel perderão as permissões associadas.`)) return;
    const res = await deleteRole(role.id, accessToken);
    if (res.ok) {
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } else {
      const err = res.data as { message?: string };
      alert(err.message ?? 'Erro ao excluir papel.');
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* List */}
      <div className="col-span-2">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={startCreate}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            + Novo papel
          </button>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          {roles.length === 0 ? (
            <p className="p-10 text-center text-sm text-ash">Nenhum papel cadastrado.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {roles.map((role) => (
                <li key={role.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{role.name}</p>
                        {role.isSystem && (
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-400">
                            sistema
                          </span>
                        )}
                        {role.require2FA && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-400">
                            2FA
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className="mt-0.5 text-xs text-ash">{role.description}</p>
                      )}
                      <p className="mt-1 text-xs text-ash">
                        {role.permissions.length} permissão{role.permissions.length !== 1 ? 'ões' : ''}
                      </p>
                      {role.permissions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {role.permissions.slice(0, 8).map((p) => (
                            <span
                              key={p.id}
                              className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-ash"
                            >
                              {p.key}
                            </span>
                          ))}
                          {role.permissions.length > 8 && (
                            <span className="text-[10px] text-ash">
                              +{role.permissions.length - 8}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(role)}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Editar
                      </button>
                      {!role.isSystem && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(role)}
                          className="text-xs text-red-400 hover:underline"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Form panel */}
      {showForm && (
        <div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">
              {editing ? `Editar: ${editing.name}` : 'Novo papel'}
            </h3>

            <div>
              <label className={labelCls}>Nome (slug) *</label>
              <input
                {...register('name')}
                placeholder="suporte-agent"
                className={inputCls}
                disabled={!!editing?.isSystem}
              />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea {...register('description')} rows={2} className={inputCls} />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-ash">
                <input type="checkbox" {...register('requireEmailVerified')} />
                Requer e-mail verificado
              </label>
              <label className="flex items-center gap-2 text-xs text-ash">
                <input type="checkbox" {...register('require2FA')} />
                Requer 2FA
              </label>
            </div>

            {/* Permissions grouped by module */}
            {Object.keys(permsByModule).length > 0 && (
              <div>
                <p className={labelCls}>
                  Permissões ({selectedPerms.length} selecionadas)
                </p>
                <div className="max-h-64 overflow-y-auto rounded-md border border-white/8 bg-background p-3 space-y-3">
                  {Object.entries(permsByModule).map(([module, perms]) => (
                    <div key={module}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ash">
                        {module}
                      </p>
                      <div className="space-y-1">
                        {perms.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 text-xs">
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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar papel'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-white/8 px-4 py-2 text-sm text-ash hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
