'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { createDepartment, updateDepartment, deleteDepartment } from '@/lib/rh-api';
import type { DepartmentItem } from '@/lib/rh-api';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  managerId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initial: DepartmentItem[];
  canEdit: boolean;
  accessToken: string;
}

export function DepartamentosManager({ initial, canEdit, accessToken }: Props): JSX.Element {
  const [departments, setDepartments] = useState<DepartmentItem[]>(initial);
  const [editing, setEditing] = useState<DepartmentItem | null>(null);
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
    reset({ name: '', description: '', managerId: '' });
    setShowForm(true);
  }

  function startEdit(dept: DepartmentItem) {
    setEditing(dept);
    reset({
      name: dept.name,
      description: dept.description ?? '',
      managerId: dept.managerId ?? '',
    });
    setShowForm(true);
  }

  async function onSubmit(data: FormData) {
    setError(null);
    const payload = {
      name: data.name,
      description: data.description,
      managerId: data.managerId || undefined,
    };

    const res = editing
      ? await updateDepartment(editing.id, payload, accessToken)
      : await createDepartment(payload, accessToken);

    if (res.ok) {
      setShowForm(false);
      const updated = res.data as DepartmentItem;
      if (editing) {
        setDepartments((prev) => prev.map((d) => (d.id === editing.id ? updated : d)));
      } else {
        setDepartments((prev) => [...prev, updated]);
      }
    } else {
      const err = res.data as { message?: string | string[] };
      setError(Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Erro ao salvar.'));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este departamento? Funcionários vinculados não serão removidos.')) return;
    const res = await deleteDepartment(id, accessToken);
    if (res.ok) {
      setDepartments((prev) => prev.filter((d) => d.id !== id));
    } else {
      alert('Erro ao excluir departamento. Verifique se há funcionários vinculados.');
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
              + Novo departamento
            </button>
          </div>
        )}

        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          {departments.length === 0 ? (
            <p className="p-10 text-center text-sm text-ash">
              Nenhum departamento cadastrado.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Departamento</th>
                  <th className="px-4 py-3 text-left font-medium">Gestor</th>
                  <th className="px-4 py-3 text-left font-medium">Funcionários</th>
                  {canEdit && <th className="px-4 py-3 text-right font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{d.name}</p>
                      {d.description && (
                        <p className="text-xs text-ash">{d.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {d.managerName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-ash">{d.employeeCount}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(d)}
                          className="mr-2 text-xs text-sky-400 hover:underline"
                        >
                          Editar
                        </button>
                        {d.employeeCount === 0 && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(d.id)}
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
              {editing ? 'Editar departamento' : 'Novo departamento'}
            </h3>

            <div>
              <label className={labelCls}>Nome *</label>
              <input {...register('name')} placeholder="Tecnologia" className={inputCls} />
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
            </div>

            <div>
              <label className={labelCls}>Descrição</label>
              <textarea {...register('description')} rows={2} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>ID do gestor (funcionário)</label>
              <input
                {...register('managerId')}
                placeholder="cuid do funcionário gestor"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-ash">
                Cole o ID do funcionário que gerencia este departamento.
              </p>
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
                {isSubmitting ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar departamento'}
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
