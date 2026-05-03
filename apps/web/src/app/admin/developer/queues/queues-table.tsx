'use client';

import { Fragment, useEffect, useState } from 'react';

export interface QueueSummary {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

interface JobSummary {
  id: string;
  name: string;
  attemptsMade: number;
  failedReason: string | null;
}

export function QueuesTable({
  initial,
  error,
}: {
  initial: QueueSummary[];
  error: string | null;
}): JSX.Element {
  const [queues, setQueues] = useState<QueueSummary[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobSummary[]>([]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, []);

  async function refresh(): Promise<void> {
    const res = await fetch('/admin/developer/api/proxy/queues', {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as QueueSummary[];
      setQueues(data);
    }
  }

  async function loadJobs(name: string): Promise<void> {
    if (expanded === name) {
      setExpanded(null);
      setJobs([]);
      return;
    }
    setExpanded(name);
    const res = await fetch(
      `/admin/developer/api/proxy/queues/${encodeURIComponent(name)}/jobs?status=failed&limit=20`,
    );
    if (res.ok) {
      setJobs((await res.json()) as JobSummary[]);
    } else {
      setJobs([]);
    }
  }

  async function retryJob(queueName: string, jobId: string): Promise<void> {
    setBusy(`${queueName}:${jobId}`);
    try {
      const res = await fetch(
        `/admin/developer/api/proxy/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}/retry`,
        { method: 'POST' },
      );
      if (!res.ok) alert('Falha ao reprocessar');
      await loadJobs(queueName);
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  async function cleanFailed(queueName: string): Promise<void> {
    if (!confirm(`Limpar todos os jobs falhos de "${queueName}"?`)) return;
    setBusy(queueName);
    try {
      const res = await fetch(
        `/admin/developer/api/proxy/queues/${encodeURIComponent(queueName)}/jobs/failed`,
        { method: 'DELETE' },
      );
      if (!res.ok) alert('Falha ao limpar');
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Filas BullMQ</h1>
          <p className="mt-1 text-sm text-ash">
            Monitore e gerencie jobs em background
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-white/8 bg-secondary px-3 py-1.5 text-xs hover:bg-accent"
        >
          Atualizar
        </button>
      </header>

      {error ? (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          {error}
        </div>
      ) : null}

      {queues.length === 0 && !error ? (
        <div className="rounded-md border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-ash">
          Nenhuma fila encontrada. Verifique se há workers BullMQ rodando.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Fila</th>
                <th className="px-3 py-3 text-right">Ativos</th>
                <th className="px-3 py-3 text-right">Esperando</th>
                <th className="px-3 py-3 text-right">Atrasados</th>
                <th className="px-3 py-3 text-right text-rose-400">Falhos</th>
                <th className="px-3 py-3 text-right">Concluídos</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <Fragment key={q.name}>
                  <tr className="border-t border-white/8 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => void loadJobs(q.name)}
                        className="hover:underline"
                      >
                        {expanded === q.name ? '▼' : '▶'} {q.name}
                      </button>
                      {q.paused ? (
                        <span className="ml-2 text-xs text-amber-400">
                          (pausada)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {q.active}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {q.waiting}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {q.delayed}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums text-rose-400">
                      {q.failed}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-ash">
                      {q.completed}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void cleanFailed(q.name)}
                        disabled={q.failed === 0 || busy === q.name}
                        className="rounded-md bg-rose-500/10 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-30"
                      >
                        Limpar falhos
                      </button>
                    </td>
                  </tr>
                  {expanded === q.name && jobs.length > 0 ? (
                    <tr className="bg-secondary/10">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="space-y-1.5">
                          {jobs.map((j) => (
                            <div
                              key={j.id}
                              className="flex items-center gap-3 rounded bg-background p-2 text-xs"
                            >
                              <span className="font-mono text-ash">
                                #{j.id}
                              </span>
                              <span className="font-medium">{j.name}</span>
                              <span className="text-ash">
                                {j.attemptsMade} tentativas
                              </span>
                              {j.failedReason ? (
                                <span className="flex-1 truncate text-rose-400">
                                  {j.failedReason}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void retryJob(q.name, j.id)}
                                disabled={busy === `${q.name}:${j.id}`}
                                className="ml-auto rounded-md bg-copper/10 px-2 py-1 text-copper hover:bg-copper/20 disabled:opacity-50"
                              >
                                Reprocessar
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
