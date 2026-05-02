'use client';

import { formatDate } from '@/lib/format';

export function CancelModal({
  open,
  onClose,
  onConfirm,
  loading,
  periodEnd,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  periodEnd: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-foreground">Cancelar assinatura</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tem certeza que deseja cancelar sua assinatura?
        </p>

        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Seu acesso continuara ativo ate{' '}
          <span className="font-semibold">{formatDate(periodEnd)}</span>.
          Apos essa data, os recursos serao suspensos.
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
          >
            Manter assinatura
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-destructive text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Confirmar cancelamento'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
