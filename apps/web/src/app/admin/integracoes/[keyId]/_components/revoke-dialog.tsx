'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

import { actionRevokeApiKey } from '../actions';

interface RevokeDialogProps {
  keyId: string;
  keyName: string;
}

export function RevokeDialog({ keyId, keyName }: RevokeDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRevoke(): Promise<void> {
    setLoading(true);
    setError(null);
    const res = await actionRevokeApiKey(keyId, reason.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSuccess(true);
  }

  function close(): void {
    setOpen(false);
    setReason('');
    setError(null);
    setSuccess(false);
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-red-400 hover:text-red-300"
      >
        Revogar
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-white/8 bg-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Revogar chave de API
          </h2>
          <button
            type="button"
            onClick={close}
            className="text-ash hover:text-foreground"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <span className="text-lg">✓</span> Chave revogada com sucesso
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={close}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
                <p className="font-semibold">Atenção: esta ação é irreversível.</p>
                <p className="mt-1">
                  A chave <span className="font-mono font-medium text-foreground">{keyName}</span>{' '}
                  será revogada e todas as integrações que a utilizam deixarão de funcionar.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ash">
                  Motivo da revogação (opcional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex: Comprometimento de segurança, integração descontinuada..."
                  className="rounded-lg border border-white/8 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => { void handleRevoke(); }}
                  className="bg-red-600 hover:bg-red-500 text-white"
                >
                  {loading ? 'Revogando…' : 'Revogar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
