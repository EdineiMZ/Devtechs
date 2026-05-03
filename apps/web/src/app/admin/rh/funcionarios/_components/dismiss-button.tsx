'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { actionDismissEmployee } from '../actions';

interface Props {
  employeeId: string;
  employeeName: string;
}

export function DismissButton({ employeeId, employeeName }: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    setLoading(true);
    setError(null);
    const res = await actionDismissEmployee(employeeId);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="ml-3 text-xs text-red-400 hover:text-red-300 hover:underline"
      >
        Demitir
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-[hsl(222,47%,9%)] p-6 shadow-2xl">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">⚠</span>
              <h2 className="text-base font-bold text-foreground">Confirmar desligamento</h2>
            </div>
            <p className="mt-2 text-sm text-ash">
              Você está prestes a desligar{' '}
              <span className="font-semibold text-foreground">{employeeName}</span>.
              O registro será mantido com status{' '}
              <span className="font-mono text-red-400">DISMISSED</span> e a data de
              desligamento será registrada como hoje.
            </p>
            <p className="mt-2 text-xs text-amber-400/80">
              Esta ação pode ser revertida editando o funcionário.
            </p>

            {error && (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg border border-white/8 px-4 py-2 text-sm text-ash hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirm(); }}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? 'Desligando…' : 'Confirmar desligamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
