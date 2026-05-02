'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createPosition, updatePosition, deletePosition } from '@/lib/rh-api';
import type { PositionItem } from '@/lib/rh-api';

const LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR'] as const;

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  level: z.enum(LEVELS, { errorMap: () => ({ message: 'Nível obrigatório' }) }),
  description: z.string().optional(),
  salary: z
    .string()
    .optional()
    .transform((v) => (v ? parseFloat(v.replace(',', '.')) : undefined))
    .refine((v) => v === undefined || (!isNaN(v as number) && (v as number) >= 0), {
      message: 'Salário deve ser um valor positivo',
    }),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initial: PositionItem[];
  canEdit: boolean;
  accessToken: string;
  levelLabels: Record<string, string>;
}

export function CargosManager({ initial, canEdit, accessToken, levelLabels }: Props): JSX.Element {
  const [positions, setPositions] = useState<PositionItem[]>(initial);
  const [editing, setEditing] = useState<PositionItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  function startCreate() {
    setEditing(null);
    reset({ name: '', level: 'MID', description: '', salary: '' as any });
    setShowForm(true);
  }

  function startEdit(pos: PositionItem) {
    setEditing(pos);
    reset({
      name: pos.name,
      level: pos.level as any,
      description: pos.description ?? '',
      salary: pos.salary ?? '' as any,
    });
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    setError(null);
    const payload = {
      name: data.name,
      level: data.level,
      description: data.description,
      salary: data.salary as unknown as number | undefined,
    };

    const res = editing
      ? await updatePosition(editing.id, payload, accessToken)
      : await createPosition(payload, accessToken);

    if (res.ok) {
      setShowForm(false);
      const updated = res.data as PositionItem;
      if (editing) {
        setPositions((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
      } else {
        setPositions((prev) => [...prev, updated]);
      }
    } else {
      const err = res.data as { message?: string | string[] };
      setError(Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao salvar.'));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cargo? Funcionários vinculados não serão removidos.')) return;
    const res = await deletePosition(id, accessToken);
    if (res.ok) {
      setPositions((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert('Erro ao excluir cargo. Verifique se há funcionários vinculados.');
    }
  }

  const inputCls =
    'w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500';
  const labelCls = 'mb-1 block text-xs font-medium text-ash';

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* List */}
      <div className="col-span-2">
        {canEdit && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={startCreate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              + Novo cargo
            </button>
          </div>
        )}

        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          {positions.length === 0 ? (
            <p className="p-10 text-center text-sm text-ash">
              Nenhum cargo cadastrado.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Cargo</th>
                  <th className="px-4 py-3 text-left font-medium">Nível</th>
                  <th className="px-4 py-3 text-left font-medium">Faixa salarial</th>
                  <th className="px-4 py-3 text-left font-medium">Funcionários</th>
                  {canEdit && <th className="px-4 py-3 text-right font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {positions.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.description && (
                        <p className="text-xs text-ash">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                        {levelLabels[p.level] ?? p.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {p.salary
                        ? `R$ ${Number(p.salary).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-ash">{p.employeeCount}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="mr-2 text-xs text-sky-400 hover:underline"
                        >
                          Editar
                        </button>
                        {p.employeeCount === 0 && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(p.id)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && canEdit && (
        <div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">
              {editing ? 'Editar cargo' : 'Novo cargo'}
            </h3>

            <div>
              <label className={labelCls}>Nome *</label>
              <input {...register('name')} placeholder="Desenvolvedor Backend" className={inputCls} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Nível *</label>
              <select {...register('level')} className={inputCls}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {levelLabels[l] ?? l}
                  </option>
                ))}
              </select>
              {errors.level && <p className="mt-1 text-xs text-red-400">{errors.level.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Faixa salarial (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ash">
                  R$
                </span>
                <input
                  {...register('salary' as any)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {(errors as any).salary && (
                <p className="mt-1 text-xs text-red-400">{(errors as any).salary?.message}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea {...register('description')} rows={2} className={inputCls} />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar cargo'}
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
