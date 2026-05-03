'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { PaymentCondition } from '@/lib/finance-api';
import {
  createPaymentCondition,
  deletePaymentCondition,
  updatePaymentCondition,
} from '@/lib/finance-api';

interface CondicoesClientProps {
  conditions: PaymentCondition[];
  accessToken: string;
}

interface FormState {
  name: string;
  description: string;
  installments: string;
  interestRate: string;
  active: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  installments: '1',
  interestRate: '0',
  active: true,
});

export function CondicoesClient({
  conditions,
  accessToken,
}: CondicoesClientProps): JSX.Element {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate(): void {
    setEditId(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: PaymentCondition): void {
    setEditId(c.id);
    setForm({
      name: c.name,
      description: c.description ?? '',
      installments: String(c.installments),
      interestRate: String(c.interestRate * 100), // convert 0.0199 → 1.99
      active: c.active,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description || null,
      installments: Number(form.installments),
      interestRate: Number(form.interestRate) / 100, // 1.99 → 0.0199
      active: form.active,
    };

    const res = editId
      ? await updatePaymentCondition(editId, payload, accessToken)
      : await createPaymentCondition(payload, accessToken);

    setLoading(false);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] })?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao salvar.'));
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(): Promise<void> {
    if (!deleteId) return;
    setLoading(true);
    await deletePaymentCondition(deleteId, accessToken);
    setLoading(false);
    setDeleteId(null);
    router.refresh();
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Financeiro</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Condições de Pagamento
          </h1>
          <p className="mt-1 text-sm text-ash">
            Configure parcelamentos e taxas de juros utilizados no checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          + Nova condição
        </button>
      </header>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {conditions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-ash">
              Nenhuma condição cadastrada. Crie uma para configurar parcelamentos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-center font-medium">Parcelas</th>
                  <th className="px-4 py-3 text-center font-medium">Juros a.m.</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {conditions.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.name}</p>
                      {c.description ? (
                        <p className="text-xs text-ash">{c.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">
                      {c.installments}×
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">
                      {c.interestRate === 0
                        ? <span className="text-emerald-400">sem juros</span>
                        : <span>{(c.interestRate * 100).toFixed(2)}%</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          c.active
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-white/5 text-ash'
                        }`}
                      >
                        {c.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-xs text-copper hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(c.id)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit form modal */}
      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] p-6 shadow-xl"
          >
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {editId ? 'Editar condição' : 'Nova condição de pagamento'}
            </h2>

            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ash">
                  Nome *
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: 3× sem juros"
                  className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ash">
                  Descrição
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Parcelamento sem acréscimo para valores acima de R$ 100"
                  className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ash">
                    Nº de parcelas *
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={48}
                    value={form.installments}
                    onChange={(e) => setForm({ ...form, installments: e.target.value })}
                    className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-ash">
                    Juros a.m. (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    placeholder="0 = sem juros"
                    className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-white/8"
                />
                Condição ativa (aparece no checkout)
              </label>
            </div>

            {error ? (
              <p role="alert" className="mt-3 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-ash hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {loading ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Delete confirmation */}
      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.02] p-6 shadow-xl">
            <h2 className="mb-2 text-base font-semibold text-foreground">Excluir condição?</h2>
            <p className="mb-4 text-sm text-ash">
              Esta ação é irreversível. A condição será removida permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-ash hover:bg-white/5 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={loading}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:bg-destructive/80 disabled:opacity-50"
              >
                {loading ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
