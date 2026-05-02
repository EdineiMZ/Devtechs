'use client';

import { useState } from 'react';

import { rollbackDeployment } from '@/lib/devops-api';

interface Props {
  deploymentId: string;
  service: string;
  imageTag: string;
  accessToken: string;
}

export function RollbackButton({ deploymentId, service, imageTag, accessToken }: Props): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleRollback() {
    const confirmed = window.confirm(
      `Reverter ${service} para a imagem "${imageTag}"?\n\nEsta ação é irreversível neste deploy.`,
    );
    if (!confirmed) return;

    setStatus('loading');
    setError(null);
    try {
      const res = await rollbackDeployment(deploymentId, accessToken);
      if (res.ok) {
        setStatus('done');
      } else {
        const err = res.data as { message?: string };
        setError(err.message ?? 'Erro ao fazer rollback.');
        setStatus('error');
      }
    } catch {
      setError('Erro de rede.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <span className="text-xs text-emerald-400">Rollback iniciado</span>
    );
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {error && <span className="text-[11px] text-red-400">{error}</span>}
      <button
        onClick={handleRollback}
        disabled={status === 'loading'}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        {status === 'loading' ? 'Revertendo…' : 'Rollback'}
      </button>
    </div>
  );
}
