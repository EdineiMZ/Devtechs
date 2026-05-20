'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { RecurringSubscription } from '@/lib/recurring-billing-api';
import type { InvoiceClient } from '@/lib/finance-api';
import { cancelRecurringSubscription } from '@/lib/recurring-billing-api';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativa', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  EXPIRED: { label: 'Expirada', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  SUSPENDED: { label: 'Suspensa', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Assinaturas Recorrentes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gerencie cobranças recorrentes dos clientes
          </p>
        </div>
        {canManage && (
          <Link
            href="/admin/financeiro/assinaturas/nova"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
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
          const info = s === 'ALL' ? { label: 'Total', className: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' } : STATUS_LABELS[s]!;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg border p-4 text-left transition-all ${statusFilter === s ? 'ring-2 ring-blue-500' : ''} ${s === 'ALL' ? info.className : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
            >
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s === 'ALL' ? 'Total' : (STATUS_LABELS[s]?.label ?? s)}</p>
            </button>
          );
        })}
      </div>

      {statusFilter === 'ACTIVE' && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
          <span className="text-sm font-medium text-green-800 dark:text-green-300">
            Receita recorrente ativa: {formatBRL(totalMonthly)}/mês
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Nenhuma assinatura encontrada
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                {['Cliente', 'Assinatura', 'Valor/mês', 'Dia cobr.', 'Próx. cobrança', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.map((sub) => {
                const st = STATUS_LABELS[sub.status] ?? { label: sub.status, className: '' };
                return (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {sub.client?.name ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {sub.client?.email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-white">{sub.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {sub.items.length} {sub.items.length === 1 ? 'item' : 'itens'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {formatBRL(sub.monthlyTotal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      Dia {sub.billingDay}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {sub.status === 'ACTIVE' ? formatDate(sub.nextBillingDate) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>
                        {st.label}
                      </span>
                      {sub.status === 'CANCELLED' && sub.endsAt && (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Encerra {formatDate(sub.endsAt.split('T')[0] ?? sub.endsAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/financeiro/assinaturas/${sub.id}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Detalhes
                        </Link>
                        {(canCancel ?? canManage) && sub.status === 'ACTIVE' && (
                          <button
                            onClick={() => setCancelModal({ subscription: sub, reason: '', immediate: false })}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Cancelar assinatura
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              <strong>{cancelModal.subscription.name}</strong> — {cancelModal.subscription.client?.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo do cancelamento (opcional)
                </label>
                <textarea
                  rows={3}
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Cliente solicitou cancelamento..."
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelModal.immediate}
                  onChange={(e) => setCancelModal({ ...cancelModal, immediate: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Cancelamento imediato
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cancelModal.immediate
                      ? 'Acesso encerrado agora.'
                      : `Acesso mantido até ${formatDate(cancelModal.subscription.nextBillingDate)} (próxima cobrança).`}
                  </p>
                </div>
              </label>
            </div>

            {cancelError && (
              <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setCancelModal(null); setCancelError(null); }}
                className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
