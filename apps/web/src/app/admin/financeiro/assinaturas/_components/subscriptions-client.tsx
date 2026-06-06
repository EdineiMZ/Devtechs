'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { RecurringSubscription } from '@/lib/recurring-billing-api';
import type { InvoiceClient } from '@/lib/finance-api';
import { cancelRecurringSubscription } from '@/lib/recurring-billing-api';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'Ativa',      className: 'bg-emerald-500/15 text-emerald-400' },
  CANCELLED: { label: 'Cancelada',  className: 'bg-red-500/15 text-red-400' },
  EXPIRED:   { label: 'Expirada',   className: 'bg-white/[0.06] text-ash' },
  SUSPENDED: { label: 'Suspensa',   className: 'bg-amber-500/15 text-amber-400' },
};

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

interface Props {
  subscriptions: RecurringSubscription[];
  clients: InvoiceClient[];
  accessToken: string;
  canManage: boolean;
  canCancel?: boolean;
}

interface CancelModalState {
  subscription: RecurringSubscription;
  reason: string;
  immediate: boolean;
}

export function SubscriptionsClient({ subscriptions, clients: _clients, accessToken, canManage, canCancel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cancelModal, setCancelModal] = useState<CancelModalState | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filtered = statusFilter === 'ALL'
    ? subscriptions
    : subscriptions.filter((s) => s.status === statusFilter);

  async function handleCancel() {
    if (!cancelModal) return;
    setCancelError(null);
    const res = await cancelRecurringSubscription(
      cancelModal.subscription.id,
      { reason: cancelModal.reason || undefined, immediate: cancelModal.immediate },
      accessToken,
    );
    if (!res.ok) {
      setCancelError((res.data as { message?: string }).message ?? 'Erro ao cancelar');
      return;
    }
    setCancelModal(null);
    startTransition(() => router.refresh());
  }

  const totalMonthly = filtered
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + s.monthlyTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Assinaturas Recorrentes
          </h1>
          <p className="mt-1 text-sm text-ash">
            Gerencie cobranças recorrentes dos clientes
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/financeiro/assinaturas/nova"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova assinatura
          </Link>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(['ALL', 'ACTIVE', 'CANCELLED', 'SUSPENDED'] as const).map((s) => {
          const count = s === 'ALL' ? subscriptions.length : subscriptions.filter((x) => x.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl border p-4 text-left transition-all bg-white/[0.02] border-white/8 ${statusFilter === s ? 'ring-1 ring-primary' : ''}`}
            >
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-sm text-ash">{s === 'ALL' ? 'Total' : (STATUS_LABELS[s]?.label ?? s)}</p>
            </button>
          );
        })}
      </div>

      {statusFilter === 'ACTIVE' && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
          <span className="text-sm font-medium text-emerald-400">
            Receita recorrente ativa: {formatBRL(totalMonthly)}/mês
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-ash">
            Nenhuma assinatura encontrada
          </div>
        ) : (
          <table className="min-w-full divide-y divide-white/8">
            <thead className="bg-white/[0.04]">
              <tr>
                {['Cliente', 'Assinatura', 'Valor/mês', 'Dia cobr.', 'Próx. cobrança', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ash">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {filtered.map((sub) => {
                const st = STATUS_LABELS[sub.status] ?? { label: sub.status, className: '' };
                return (
                  <tr key={sub.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-foreground">
                        {sub.client?.name ?? '—'}
                      </div>
                      <div className="text-xs text-ash">
                        {sub.client?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{sub.name}</div>
                      <div className="text-xs text-ash">
                        {sub.items.length} {sub.items.length === 1 ? 'item' : 'itens'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {formatBRL(sub.monthlyTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-ash">
                      Dia {sub.billingDay}
                    </td>
                    <td className="px-4 py-3 text-sm text-ash">
                      {sub.status === 'ACTIVE' ? formatDate(sub.nextBillingDate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>
                        {st.label}
                      </span>
                      {sub.status === 'CANCELLED' && sub.endsAt && (
                        <div className="mt-0.5 text-xs text-ash">
                          Encerra {formatDate(sub.endsAt.split('T')[0] ?? sub.endsAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/financeiro/assinaturas/${sub.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Detalhes
                        </Link>
                        {(canCancel ?? canManage) && sub.status === 'ACTIVE' && (
                          <button
                            onClick={() => setCancelModal({ subscription: sub, reason: '', immediate: false })}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/8 bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Cancelar assinatura
            </h2>
            <p className="text-sm text-ash mb-4">
              <strong className="text-foreground">{cancelModal.subscription.name}</strong> — {cancelModal.subscription.client?.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ash mb-1">
                  Motivo do cancelamento (opcional)
                </label>
                <textarea
                  rows={3}
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                  className="w-full rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Cliente solicitou cancelamento..."
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelModal.immediate}
                  onChange={(e) => setCancelModal({ ...cancelModal, immediate: e.target.checked })}
                  className="h-4 w-4 rounded border-white/30 text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    Cancelamento imediato
                  </span>
                  <p className="text-xs text-ash">
                    {cancelModal.immediate
                      ? 'Acesso encerrado agora.'
                      : `Acesso mantido até ${formatDate(cancelModal.subscription.nextBillingDate)} (próxima cobrança).`}
                  </p>
                </div>
              </label>
            </div>

            {cancelError && (
              <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setCancelModal(null); setCancelError(null); }}
                className="rounded-lg border border-white/8 px-4 py-2 text-sm font-medium text-ash hover:bg-white/[0.04]"
              >
                Voltar
              </button>
              <button
                onClick={() => void handleCancel()}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
