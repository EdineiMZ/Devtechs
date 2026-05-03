'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────

interface ServiceStatus {
  name: string;
  displayName: string;
  port: number;
  online: boolean;
  responseMs: number | null;
  lastChecked: string;
  upSince: string | null;
  downSince: string | null;
  consecutiveFailures: number;
  autoRestart: boolean;
}

interface LogLine {
  service: string;
  line: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

interface AutoRestartedEvent {
  service: string;
  displayName: string;
  ts: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const MAX_LOG_LINES = 1000;
const MAX_TOASTS = 5;

const LEVEL_STYLE: Record<LogLine['level'], string> = {
  ERROR: 'border-l-2 border-rose-500 bg-rose-950/30 text-rose-300',
  WARN:  'border-l-2 border-amber-500 bg-amber-950/20 text-amber-300',
  INFO:  'text-zinc-200',
  DEBUG: 'text-zinc-500',
};

// ─── Helper components ────────────────────────────────────────────────

function StatusDot({ online }: { online: boolean }): JSX.Element {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        online ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'
      }`}
    />
  );
}

function Badge({
  online,
  failures,
}: {
  online: boolean;
  failures: number;
}): JSX.Element {
  if (online) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
        Online
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">
      {failures > 0 ? `Offline (${failures}×)` : 'Offline'}
    </span>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function uptimeFrom(since: string | null): string | null {
  if (!since) return null;
  const secs = Math.floor((Date.now() - new Date(since).getTime()) / 1000);
  return formatUptime(secs);
}

// ─── Toast ────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

let toastCounter = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev.slice(-MAX_TOASTS + 1), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return { toasts, push };
}

// ─── Main Component ───────────────────────────────────────────────────

export function MonitorPanel({
  initial,
  accessToken,
  wsUrl,
  canControl,
}: {
  initial: ServiceStatus[];
  accessToken: string;
  wsUrl: string;
  canControl: boolean;
}): JSX.Element {
  const [services, setServices] = useState<Map<string, ServiceStatus>>(
    () => new Map(initial.map((s) => [s.name, s])),
  );
  const [connected, setConnected] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [logLevel, setLogLevel] = useState<'ALL' | LogLine['level']>('ALL');
  const [logPaused, setLogPaused] = useState(false);
  const [logAutoScroll, setLogAutoScroll] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const monitorSocketRef = useRef<Socket | null>(null);
  const logsSocketRef = useRef<Socket | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const subscribedLog = useRef<string | null>(null);
  const { toasts, push: pushToast } = useToasts();

  // ─── Monitor WebSocket ─────────────────────────────────────────────

  useEffect(() => {
    const socket = io(`${wsUrl}/monitor`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Full snapshot on connect
    socket.on('monitor:status', (all: ServiceStatus[]) => {
      setServices(new Map(all.map((s) => [s.name, s])));
    });

    // Incremental updates
    socket.on('monitor:update', (s: ServiceStatus) => {
      setServices((prev) => new Map(prev).set(s.name, s));
    });

    socket.on('monitor:statusChange', (s: ServiceStatus) => {
      pushToast(
        `${s.displayName} está ${s.online ? 'ONLINE ✓' : 'OFFLINE ✗'}`,
        s.online ? 'success' : 'error',
      );
    });

    socket.on('monitor:autoRestarted', (e: AutoRestartedEvent) => {
      pushToast(`Auto-restart: ${e.displayName} reiniciado`, 'warning');
    });

    monitorSocketRef.current = socket;
    return () => {
      socket.disconnect();
      monitorSocketRef.current = null;
    };
  }, [accessToken, wsUrl, pushToast]);

  // ─── Logs WebSocket ────────────────────────────────────────────────

  useEffect(() => {
    const socket = io(`${wsUrl}/developer`, {
      transports: ['websocket'],
      auth: { token: accessToken },
      reconnection: true,
    });

    socket.on('logs:line', (line: LogLine) => {
      if (!logPaused) {
        setLogLines((prev) => {
          const next = [...prev, line];
          return next.length > MAX_LOG_LINES
            ? next.slice(next.length - MAX_LOG_LINES)
            : next;
        });
      }
    });

    logsSocketRef.current = socket;
    return () => {
      socket.disconnect();
      logsSocketRef.current = null;
    };
  }, [accessToken, wsUrl, logPaused]);

  // Subscribe / unsubscribe logs when selectedLog changes
  useEffect(() => {
    const socket = logsSocketRef.current;
    if (!socket) return;
    if (subscribedLog.current && subscribedLog.current !== selectedLog) {
      socket.emit('logs:unsubscribe', { serviceName: subscribedLog.current });
    }
    if (selectedLog) {
      setLogLines([]);
      socket.emit('logs:subscribe', { serviceName: selectedLog }, (ack: { ok: boolean }) => {
        if (!ack?.ok) pushToast(`Falha ao abrir logs de ${selectedLog}`, 'error');
      });
    }
    subscribedLog.current = selectedLog;
    return () => {
      if (selectedLog) socket.emit('logs:unsubscribe', { serviceName: selectedLog });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLog]);

  // Auto-scroll logs
  useEffect(() => {
    if (logAutoScroll && !logPaused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines, logAutoScroll, logPaused]);

  // ─── Actions ──────────────────────────────────────────────────────

  const callAction = useCallback(
    async (name: string, action: 'start' | 'stop' | 'restart') => {
      setLoadingAction(`${name}:${action}`);
      try {
        const res = await fetch(
          `/admin/developer/api/proxy/monitor/${encodeURIComponent(name)}/${action}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
        const body = (await res.json()) as { ok: boolean; message: string };
        pushToast(body.message, body.ok ? 'success' : 'error');
      } catch {
        pushToast('Erro ao enviar comando', 'error');
      } finally {
        setLoadingAction(null);
      }
    },
    [accessToken, pushToast],
  );

  const toggleAutoRestart = useCallback(
    async (name: string, enabled: boolean) => {
      try {
        const res = await fetch(
          `/admin/developer/api/proxy/monitor/${encodeURIComponent(name)}/auto-restart`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ enabled }),
          },
        );
        const body = (await res.json()) as ServiceStatus | { message: string };
        if ('name' in body) {
          setServices((prev) => new Map(prev).set(body.name, body));
          pushToast(
            `Auto-restart ${enabled ? 'ativado' : 'desativado'} para ${name}`,
            'info',
          );
        }
      } catch {
        pushToast('Erro ao configurar auto-restart', 'error');
      }
    },
    [accessToken, pushToast],
  );

  // ─── Derived ──────────────────────────────────────────────────────

  const serviceList = useMemo(
    () => Array.from(services.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const onlineCount = useMemo(
    () => serviceList.filter((s) => s.online).length,
    [serviceList],
  );

  const visibleLogs = useMemo(
    () =>
      logLines.filter((l) => {
        if (logLevel !== 'ALL' && l.level !== logLevel) return false;
        if (logFilter && !l.line.toLowerCase().includes(logFilter.toLowerCase()))
          return false;
        return true;
      }),
    [logLines, logFilter, logLevel],
  );

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Connection status bar */}
      <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}
          />
          <span className="text-ash">
            {connected ? 'Conectado ao monitor' : 'Reconectando...'}
          </span>
        </div>
        <span className="font-mono text-xs text-ash">
          {onlineCount}/{serviceList.length} online
        </span>
      </div>

      {/* Summary stat bar */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(['Online', 'Offline'] as const).map((label) => {
          const count =
            label === 'Online' ? onlineCount : serviceList.length - onlineCount;
          return (
            <div
              key={label}
              className={`rounded-lg border px-3 py-2 text-center ${
                label === 'Online'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : count > 0
                  ? 'border-red-500/20 bg-red-500/5'
                  : 'border-white/8 bg-white/[0.02]'
              }`}
            >
              <p
                className={`text-2xl font-bold ${
                  label === 'Online'
                    ? 'text-emerald-400'
                    : count > 0
                    ? 'text-red-400'
                    : 'text-ash'
                }`}
              >
                {count}
              </p>
              <p className="text-xs text-ash">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Services grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {serviceList.map((svc) => {
          const isLoading = loadingAction?.startsWith(svc.name + ':');
          const uptime = uptimeFrom(svc.upSince);

          return (
            <div
              key={svc.name}
              className={`group relative rounded-xl border bg-white/[0.02] p-4 transition-all ${
                svc.online
                  ? 'border-emerald-500/20 hover:border-emerald-500/40'
                  : 'border-red-500/20 hover:border-red-500/30'
              }`}
            >
              {/* Header */}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {svc.displayName}
                  </p>
                  <p className="font-mono text-[11px] text-ash">:{svc.port}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusDot online={svc.online} />
                  <Badge online={svc.online} failures={svc.consecutiveFailures} />
                </div>
              </div>

              {/* Metrics row */}
              <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ash">
                {svc.online && svc.responseMs !== null && (
                  <span>
                    <span className="text-foreground">{svc.responseMs}ms</span> resp
                  </span>
                )}
                {svc.online && uptime && (
                  <span>
                    up <span className="text-foreground">{uptime}</span>
                  </span>
                )}
                {!svc.online && svc.downSince && (
                  <span className="text-red-400/80">
                    down {uptimeFrom(svc.downSince)}
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                {canControl && (
                  <>
                    <button
                      type="button"
                      disabled={isLoading || !svc.online}
                      onClick={() => void callAction(svc.name, 'restart')}
                      className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-ash hover:border-amber-400/30 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Reiniciar"
                    >
                      ↺ Reiniciar
                    </button>
                    <button
                      type="button"
                      disabled={isLoading || !svc.online}
                      onClick={() => void callAction(svc.name, 'stop')}
                      className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-ash hover:border-red-400/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Parar"
                    >
                      ■ Parar
                    </button>
                    <button
                      type="button"
                      disabled={isLoading || svc.online}
                      onClick={() => void callAction(svc.name, 'start')}
                      className="rounded-md border border-white/8 px-2 py-1 text-[11px] text-ash hover:border-emerald-400/30 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                      title="Iniciar"
                    >
                      ▶ Iniciar
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedLog((prev) =>
                      prev === svc.name ? null : svc.name,
                    )
                  }
                  className={`ml-auto rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    selectedLog === svc.name
                      ? 'border-copper/40 bg-copper/10 text-copper'
                      : 'border-white/8 text-ash hover:border-white/20 hover:text-foreground'
                  }`}
                  title="Ver logs"
                >
                  {'{ }'}
                </button>
              </div>

              {/* Auto-restart toggle */}
              {canControl && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-white/6 pt-2 text-[11px] text-ash">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={svc.autoRestart}
                      onChange={(e) =>
                        void toggleAutoRestart(svc.name, e.target.checked)
                      }
                    />
                    <div className="h-4 w-7 rounded-full bg-white/10 transition-colors peer-checked:bg-emerald-600" />
                    <div className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                  </div>
                  Auto-restart
                </label>
              )}

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log panel */}
      {selectedLog && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          {/* Log toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 bg-secondary/30 px-4 py-3">
            <span className="font-mono text-sm font-semibold text-copper">
              {selectedLog}
            </span>
            <span className="mx-1 text-white/20">|</span>

            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as typeof logLevel)}
              className="rounded-md border border-white/8 bg-background px-2 py-1 text-xs"
            >
              <option value="ALL">Todos</option>
              <option value="ERROR">ERROR</option>
              <option value="WARN">WARN</option>
              <option value="INFO">INFO</option>
              <option value="DEBUG">DEBUG</option>
            </select>

            <input
              type="text"
              placeholder="Filtrar..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="flex-1 rounded-md border border-white/8 bg-background px-2 py-1 text-xs"
            />

            <label className="flex items-center gap-1 text-xs text-ash">
              <input
                type="checkbox"
                checked={logAutoScroll}
                onChange={(e) => setLogAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>

            <button
              type="button"
              onClick={() => setLogPaused((p) => !p)}
              className="rounded-md border border-white/8 bg-secondary px-3 py-1 text-xs hover:bg-accent"
            >
              {logPaused ? '▶ Retomar' : '⏸ Pausar'}
            </button>

            <button
              type="button"
              onClick={() => setLogLines([])}
              className="rounded-md border border-white/8 bg-secondary px-3 py-1 text-xs hover:bg-accent"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="ml-auto rounded-md border border-white/8 px-2 py-1 text-xs text-ash hover:text-foreground"
              title="Fechar logs"
            >
              ✕
            </button>
          </div>

          {/* Log terminal */}
          <div
            ref={logRef}
            className="h-80 overflow-y-auto bg-zinc-950 font-mono text-[12px] leading-relaxed"
          >
            {visibleLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                Aguardando logs de {selectedLog}...
              </div>
            ) : (
              visibleLogs.map((line, idx) => (
                <div
                  key={idx}
                  className={`whitespace-pre-wrap break-all px-3 py-0.5 ${LEVEL_STYLE[line.level]}`}
                >
                  <span className="mr-2 select-none text-zinc-600">
                    {new Date(line.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                  <span className="mr-2 text-zinc-500">[{line.level}]</span>
                  {line.line}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-white/8 bg-secondary/30 px-4 py-1.5 text-[11px] text-ash">
            {visibleLogs.length}/{logLines.length} linhas
            {logPaused ? ' · ⏸ pausado' : ''}
          </div>
        </div>
      )}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-xs rounded-lg border px-4 py-2.5 text-sm shadow-xl backdrop-blur-sm transition-all ${
              t.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
                : t.type === 'error'
                ? 'border-red-500/30 bg-red-950/90 text-red-300'
                : t.type === 'warning'
                ? 'border-amber-500/30 bg-amber-950/90 text-amber-300'
                : 'border-white/15 bg-zinc-900/90 text-foreground'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
