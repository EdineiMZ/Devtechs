'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface LogLine {
  stream: 'stdout' | 'stderr';
  timestamp: string;
  message: string;
}

const SERVICES = [
  'auth-service', 'rh-service', 'finance-service', 'projects-service',
  'devops-service', 'support-service', 'payments-service', 'notification-service',
  'license-service', 'developer-service', 'web', 'store', 'nginx', 'postgres', 'redis',
];

export function LogsViewer(): JSX.Element {
  const [service, setService] = useState<string>('auth-service');
  const [tail, setTail] = useState(300);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (svc: string, t: number, isRefresh = false): Promise<void> => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/admin/developer/api/proxy/logs/${encodeURIComponent(svc)}?tail=${t}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Erro ${res.status}`);
        return;
      }
      const data = (await res.json()) as LogLine[];
      setLines(data);
    } catch {
      setError('developer-service indisponível');
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs(service, tail);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => void fetchLogs(service, tail, true), 3000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [service, tail, fetchLogs]);

  useEffect(() => {
    if (follow && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, follow]);

  function fmtTs(ts: string): string {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' });
    } catch { return ts.slice(11, 19); }
  }

  // Strip ANSI escape codes for display (regex built via string to avoid no-control-regex lint)
  function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*[mGKHF]/g, '');
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={service}
          onChange={(e) => setService(e.target.value)}
          className="rounded-lg border border-white/8 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          {SERVICES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={tail}
          onChange={(e) => setTail(Number(e.target.value))}
          className="rounded-lg border border-white/8 bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          {[100, 300, 500, 1000, 2000].map((n) => (
            <option key={n} value={n}>Últimas {n} linhas</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void fetchLogs(service, tail)}
          disabled={loading}
          className="rounded-lg border border-white/8 bg-secondary px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          Atualizar
        </button>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-ash">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
            className="accent-sky-500"
          />
          Seguir
        </label>

        {refreshing && (
          <span className="text-xs text-ash">Atualizando…</span>
        )}

        {lines.length > 0 && (
          <span className="ml-auto text-xs text-ash">{lines.length} linhas</span>
        )}
      </div>

      {/* Log window */}
      <div className="relative flex-1 overflow-y-auto rounded-xl border border-white/8 bg-[#0d0d0d] p-4 font-mono text-xs leading-5">
        {loading ? (
          <p className="text-ash">Carregando…</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : lines.length === 0 ? (
          <p className="text-ash">Nenhum log disponível para <span className="text-foreground">{service}</span>.</p>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={`flex gap-3 whitespace-pre-wrap break-all ${
                line.stream === 'stderr' ? 'text-rose-400' : 'text-green-300'
              }`}
            >
              <span className="shrink-0 text-white/30">{fmtTs(line.timestamp)}</span>
              <span>{stripAnsi(line.message)}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
