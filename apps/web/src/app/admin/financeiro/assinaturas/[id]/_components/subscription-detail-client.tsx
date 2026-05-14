'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { cancelRecurringSubscription } from '@/lib/recurring-billing-api';
import type { RecurringSubscription } from '@/lib/recurring-billing-api';

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string): string {
  const d = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  return new Date(d).toLocaleDateString('pt-BR');
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativa', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  EXPIRED: { label: 'Expirada', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  SUSPENDED: { label: 'Suspensa', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
};

interface Props {
  subscription: RecurringSubscription;
  accessToken: string;
  canManage: boolean;
}

export function SubscriptionDetailClient({ subscription: sub, accessToken, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const st = STATUS_LABELS[sub.status] ?? { label: sub.status, className: '' };

  async function handleCancel() {
    setCancelError(null);
    const res = await cancelRecurringSubscription(
      sub.id,
      { reason: cancelReason || undefined, immediate: cancelImmediate },
      accessToken,
    );
    if (!res.ok) {
      setCancelError((res.data as { message?: string }).message ?? 'Erro ao cancelar');
      return;
    }
    setCancelModal(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/financeiro/assinaturas"
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ← Assinaturas
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{sub.name}</h1>
          {sub.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${st.className}`}>
            {st.label}
          </span>
          {canManage && (sub.status === 'ACTIVE' || sub.status === 'SUSPENDED') && (
            <button
              onClick={() => setCancelModal(true)}
              className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Cancelar assinatura
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Client + Billing info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Cliente
            </h2>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {sub.client?.name ?? '—'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{sub.client?.email}</p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Cobrança
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Dia de cobrança</dt>
                <dd className="font-medium text-gray-900 dark:text-white">Dia {sub.billingDay}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Vencimento</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{sub.billingDueDays} dias após</dd>
              </div>
              {sub.status === 'ACTIVE' && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Próxima cobrança</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{formatDate(sub.nextBillingDate)}</dd>
                </div>
              )}
              {sub.cancelledAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Cancelada em</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">{formatDate(sub.cancelledAt)}</dd>
                </div>
              )}
              {sub.endsAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Encerra em</dt>
                  <dd className="font-medium text-yellow-600 dark:text-yellow-400">{formatDate(sub.endsAt)}</dd>
                </div>
              )}
            </dl>
            {sub.cancelReason && (
              <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                <strong>Motivo:</strong> {sub.cancelReason}
              </div>
            )}
          </div>

          {sub.notes && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Observações
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{sub.notes}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Itens da cobrança mensal
              </h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {['Descrição', 'Produto', 'Qtd', 'Preço unit.', 'Total'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {sub.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.product?.name ?? <span className="italic text-gray-400">Manual</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatBRL(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{formatBRL(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right text-gray-700 dark:text-gray-300">
                    Total mensal
                  </td>
                  <td className="px-4 py-3 text-base font-bold text-gray-900 dark:text-white">
                    {formatBRL(sub.monthlyTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Cancelar assinatura
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Tem certeza que deseja cancelar <strong>{sub.name}</strong>?
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Solicitação do cliente..."
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelImmediate}
                  onChange={(e) => setCancelImmediate(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Cancelamento imediato
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {cancelImmediate
                      ? 'Acesso encerrado imediatamente.'
                      : `Acesso mantido até ${formatDate(sub.nextBillingDate)}.`}
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
                onClick={() => { setCancelModal(false); setCancelError(null); }}
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
