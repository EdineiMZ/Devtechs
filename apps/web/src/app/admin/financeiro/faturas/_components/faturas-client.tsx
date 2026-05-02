'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Invoice } from '@/lib/finance-api';
import { cancelInvoice, refundInvoice } from '@/lib/finance-api';

import { NewInvoiceDialog } from './new-invoice-dialog';

interface Project {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface FaturasClientProps {
  invoices: Invoice[];
  projects: Project[];
  users: Client[];
  accessToken: string;
  currentStatus?: string;
}

const statusMap: Record<string, { label: string; classes: string }> = {
  PENDING: { label: 'Pendente', classes: 'bg-amber-500/15 text-amber-400' },
  PAID: { label: 'Pago', classes: 'bg-emerald-500/15 text-emerald-400' },
  OVERDUE: { label: 'Vencido', classes: 'bg-red-500/15 text-red-400' },
  CANCELED: { label: 'Cancelado', classes: 'bg-white/5 text-ash' },
  REFUNDED: { label: 'Estornado', classes: 'bg-violet-500/15 text-violet-400' },
};

interface ActionModalState {
  type: 'cancel' | 'refund';
  invoiceId: string;
  invoiceNumber: string;
}

export function FaturasClient({
  invoices,
  projects,
  users,
  accessToken,
  currentStatus,
}: FaturasClientProps): JSX.Element {
  const router = useRouter();
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  const [modal, setModal] = useState<ActionModalState | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleCreated(): void {
    router.refresh();
  }

  function openCancel(inv: Invoice): void {
    setReason('');
    setActionError(null);
    setModal({ type: 'cancel', invoiceId: inv.id, invoiceNumber: inv.number });
  }

  function openRefund(inv: Invoice): void {
    setReason('');
    setActionError(null);
    setModal({ type: 'refund', invoiceId: inv.id, invoiceNumber: inv.number });
  }

  async function handleConfirm(): Promise<void> {
    if (!modal) return;
    setLoading(true);
    setActionError(null);
    const fn = modal.type === 'cancel' ? cancelInvoice : refundInvoice;
    const res = await fn(modal.invoiceId, reason || undefined, accessToken);
    setLoading(false);
    if (!res.ok) {
      const msg = (res.data as { message?: string | string[] })?.message;
      setActionError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao processar ação.'));
      return;
    }
    setModal(null);
    router.refresh();
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Financeiro</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Faturas</h1>
          <p className="mt-1 text-sm text-ash">
            {invoices.length} faturas · todos os clientes
          </p>
        </div>
        <NewInvoiceDialog
          accessToken={accessToken}
          projects={projects}
          clients={users}
          onCreated={handleCreated}
        />
      </header>

      {/* Status filter */}
      <form className="mb-6 flex flex-wrap gap-2">
        {(['', 'PENDING', 'PAID', 'OVERDUE', 'CANCELED', 'REFUNDED'] as const).map((s) => (
          <button
            key={s}
            name="status"
            value={s}
            type="submit"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (currentStatus ?? '') === s
                ? 'bg-sky-600 text-white'
                : 'border border-white/8 text-ash hover:border-sky-500/40'
            }`}
          >
            {s === '' ? 'Todos' : (statusMap[s]?.label ?? s)}
          </button>
        ))}
      </form>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {invoices.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">Nenhuma fatura.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Nº / Descrição</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Projeto</th>
                  <th className="px-4 py-3 text-left font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-ash">#{inv.number}</p>
                      <p className="font-medium text-foreground">{inv.description}</p>
                      {inv.cancelReason ? (
                        <p className="mt-0.5 text-[11px] text-ash italic">
                          Motivo: {inv.cancelReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {inv.client?.name ?? inv.client?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {inv.project?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {dateFmt.format(new Date(inv.dueAt))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          statusMap[inv.status]?.classes ?? ''
                        }`}
                      >
                        {statusMap[inv.status]?.label ?? inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {fmt.format(inv.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/finance/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-copper hover:underline"
                        >
                          PDF
                        </a>
                        {/* Cancel — available on non-terminal states except PAID */}
                        {(inv.rawStatus === 'DRAFT' ||
                          inv.rawStatus === 'SENT' ||
                          inv.rawStatus === 'OVERDUE') ? (
                          <button
                            type="button"
                            onClick={() => openCancel(inv)}
                            className="text-xs text-amber-400 hover:underline"
                          >
                            Cancelar
                          </button>
                        ) : null}
                        {/* Refund — available only on PAID invoices */}
                        {inv.rawStatus === 'PAID' ? (
                          <button
                            type="button"
                            onClick={() => openRefund(inv)}
                            className="text-xs text-violet-400 hover:underline"
                          >
                            Estornar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel / Refund confirmation modal */}
      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] p-6 shadow-xl">
            <h2 className="mb-1 text-base font-semibold text-foreground">
              {modal.type === 'cancel' ? 'Cancelar fatura' : 'Estornar fatura'}
            </h2>
            <p className="mb-4 text-sm text-ash">
              Fatura{' '}
              <span className="font-mono font-medium text-foreground">
                #{modal.invoiceNumber}
              </span>
              {modal.type === 'cancel'
                ? ' será marcada como cancelada.'
                : ' será marcada como estornada e o cliente será notificado.'}
            </p>

            <label className="mb-1 block text-xs font-medium text-ash">
              Motivo <span className="text-ash/60">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                modal.type === 'cancel'
                  ? 'Ex: cobrado incorretamente, serviço não contratado…'
                  : 'Ex: cliente desistiu, pagamento duplicado…'
              }
              className="w-full resize-none rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
            />

            {actionError ? (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {actionError}
              </p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-ash hover:bg-white/5 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={loading}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  modal.type === 'cancel'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {loading
                  ? 'Processando…'
                  : modal.type === 'cancel'
                  ? 'Confirmar cancelamento'
                  : 'Confirmar estorno'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
