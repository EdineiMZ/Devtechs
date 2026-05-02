'use client';

import { useState } from 'react';

import { approveVacation, rejectVacation } from '@/lib/rh-api';

interface Props {
  vacationId: string;
  accessToken: string;
}

export function VacationApprovalButtons({ vacationId, accessToken }: Props): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setStatus('loading');
    setError(null);
    try {
      const res = await approveVacation(vacationId, accessToken);
      if (res.ok) {
        setStatus('approved');
      } else {
        setError('Erro ao aprovar.');
        setStatus('idle');
      }
    } catch {
      setError('Erro de rede.');
      setStatus('idle');
    }
  }

  async function handleReject() {
    const reason = window.prompt('Motivo da rejeição:');
    if (reason === null) return;
    setStatus('loading');
    setError(null);
    try {
      const res = await rejectVacation(vacationId, reason, accessToken);
      if (res.ok) {
        setStatus('rejected');
      } else {
        setError('Erro ao rejeitar.');
        setStatus('idle');
      }
    } catch {
      setError('Erro de rede.');
      setStatus('idle');
    }
  }

  if (status === 'approved') {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        Aprovado
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
        Rejeitado
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      <button
        onClick={handleApprove}
        disabled={status === 'loading'}
        className="rounded-md bg-emerald-600/20 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
      >
        Aprovar
      </button>
      <button
        onClick={handleReject}
        disabled={status === 'loading'}
        className="rounded-md bg-red-600/20 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-600/30 disabled:opacity-50"
      >
        Rejeitar
      </button>
    </div>
  );
}
