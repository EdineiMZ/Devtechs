'use client';

import { useEffect, useState, useTransition } from 'react';

import { formatBytesMb, formatUptime } from '@/lib/developer-format';

export interface ServiceSummary {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'exited' | 'paused' | 'unknown';
  state: string;
  uptime: number | null;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  ports: Array<{ private: number; public: number | null; protocol: string }>;
  image: string;
}

const STATUS_TONE: Record<ServiceSummary['status'], string> = {
  running: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  stopped: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  exited: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
  paused: 'bg-zinc-500/10 text-zinc-300 ring-zinc-500/30',
  unknown: 'bg-white/5 text-ash ring-white/8',
};

export function ServicesGrid({
  initial,
  error: initialError,
}: {
  initial: ServiceSummary[];
  error: string | null;
}): JSX.Element {
  const [services, setServices] = useState<ServiceSummary[]>(initial);
  const [fetchError, setFetchError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      const res = await fetch('/admin/developer/api/proxy/services', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as ServiceSummary[];
        setServices(data);
        setFetchError(null);
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFetchError(body.message ?? 'Falha ao buscar serviços');
      }
    } catch {
      setFetchError('developer-service indisponível');
    } finally {
      setRefreshing(false);
    }
  }

  async function execute(
    name: string,
    action: 'start' | 'stop' | 'restart',
  ): Promise<void> {
    setActionFor(name);
    try {
      const res = await fetch(
        `/admin/developer/api/proxy/services/${encodeURIComponent(name)}/${action}`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        alert(body.message ?? `Falha ao executar ${action}`);
      }
      startTransition(() => void refresh());
    } finally {
      setActionFor(null);
    }
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serviços</h1>
          <p className="mt-1 text-sm text-ash">
            Containers do docker-compose
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing || pending}
          className="rounded-md border border-white/8 bg-secondary px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      {fetchError ? (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <strong>Aviso:</strong> {fetchError}
          <p className="mt-1 text-xs opacity-80">
            {fetchError.toLowerCase().includes('authorization') || fetchError.toLowerCase().includes('auth')
              ? 'Verifique se o auth-service está rodando na porta configurada (padrão: 4001).'
              : fetchError.toLowerCase().includes('indisponível') || fetchError.toLowerCase().includes('developer-service')
              ? 'Verifique se o developer-service está rodando na porta configurada (padrão: 4010).'
              : `Verifique se o socket Docker (/var/run/docker.sock) está acessível pelo developer-service.`}
          </p>
        </div>
      ) : null}

      {services.length === 0 && !fetchError ? (
        <div className="rounded-md border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-ash">
          Nenhum container do docker-compose encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <article
              key={svc.containerName}
              className="space-y-4 rounded-lg border border-white/8 bg-white/[0.02] p-5"
            >
              <header className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">
                    {svc.name}
                  </h2>
                  <p className="truncate text-xs text-ash">
                    {svc.image}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ${STATUS_TONE[svc.status]}`}
                >
                  {svc.status}
                </span>
              </header>

              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-ash">Uptime</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {formatUptime(svc.uptime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ash">CPU</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {svc.cpuPercent.toFixed(1)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-ash">Memória</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">
                    {formatBytesMb(svc.memoryUsedMb)}
                  </dd>
                </div>
              </dl>

              {svc.ports.length > 0 ? (
                <div className="text-xs">
                  <span className="text-ash">Portas: </span>
                  <span className="font-mono">
                    {svc.ports
                      .map((p) =>
                        p.public ? `${p.public}→${p.private}` : `${p.private}`,
                      )
                      .join(', ')}
                  </span>
                </div>
              ) : null}

              <div className="flex gap-2 border-t border-white/8 pt-2">
                <button
                  type="button"
                  onClick={() => void execute(svc.name, 'start')}
                  disabled={svc.status === 'running' || actionFor === svc.name}
                  className="flex-1 rounded-md bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-30"
                >
                  Iniciar
                </button>
                <button
                  type="button"
                  onClick={() => void execute(svc.name, 'restart')}
                  disabled={actionFor === svc.name}
                  className="flex-1 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-30"
                >
                  Reiniciar
                </button>
                <button
                  type="button"
                  onClick={() => void execute(svc.name, 'stop')}
                  disabled={svc.status !== 'running' || actionFor === svc.name}
                  className="flex-1 rounded-md bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-30"
                >
                  Parar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
