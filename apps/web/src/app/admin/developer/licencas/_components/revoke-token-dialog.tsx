'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@szdevs/ui';

import type { ActivationToken } from '@/lib/license-api';

import { actionRevokeToken } from '../actions';

interface RevokeTokenDialogProps {
  token: ActivationToken;
}

export function RevokeTokenDialog({ token }: RevokeTokenDialogProps): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [cancelInvoice, setCancelInvoice] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [success, setSuccess] = useState(false);
  const [invoiceWarning, setInvoiceWarning] = useState<string | null>(null);

  async function handleRevoke(): Promise<void> {
    setLoading(true);
    setError(null);
    const res = await actionRevokeToken({
      tokenId: token.id,
      reason: reason.trim() || undefined,
      invoiceId: cancelInvoice && invoiceId.trim() ? invoiceId.trim() : undefined,
      invoiceCancelReason: reason.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setInvoiceWarning(res.invoiceError ?? null);
    setSuccess(true);
  }

  if (token.status !== 'ACTIVE') {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          token.status === 'REVOKED'
            ? 'bg-destructive/15 text-destructive'
            : 'bg-white/5 text-ash'
        }`}
      >
        {token.status === 'REVOKED' ? 'Revogado' : 'Expirado'}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        Revogar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-base font-bold text-foreground">Revogar token</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-ash hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-emerald-400">
                ✓ Token revogado com sucesso.
              </p>
              {invoiceWarning && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
                  <strong>Aviso:</strong> Token revogado, mas houve um erro ao cancelar a fatura:{' '}
                  {invoiceWarning}
                </div>
              )}
              <div className="flex justify-end">
                <Button type="button" onClick={() => { setOpen(false); setSuccess(false); router.refresh(); }}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Token summary */}
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs">
                <p className="text-ash">Produto</p>
                <p className="font-medium text-foreground">{token.product?.name ?? token.productId}</p>
                <p className="mt-2 text-ash">Key (prefixo)</p>
                <code className="font-mono text-foreground">{token.key.substring(0, 18)}…</code>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Motivo da revogação (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="ex: Cancelamento de contrato, inadimplência, solicitação do cliente…"
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Invoice cancellation */}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={cancelInvoice}
                    onChange={(e) => setCancelInvoice(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Cancelar assinatura / fatura associada
                    </p>
                    <p className="text-xs text-ash">
                      Se houver uma fatura ou assinatura vinculada a esta licença, informe o ID
                      para cancelá-la automaticamente.
                    </p>
                  </div>
                </label>

                {cancelInvoice && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ash">
                      ID da fatura (Financeiro)
                    </label>
                    <input
                      type="text"
                      value={invoiceId}
                      onChange={(e) => setInvoiceId(e.target.value)}
                      placeholder="ex: clu3k2abc0001xyz..."
                      className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="text-[11px] text-ash">
                      Encontre o ID no módulo Financeiro → Faturas. Deixe em branco se não houver
                      fatura associada.
                    </p>
                  </div>
                )}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => { void handleRevoke(); }}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {loading ? 'Revogando…' : 'Revogar token'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
