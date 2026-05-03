'use client';

import { useEffect, useState } from 'react';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@szdevs/ui';

import type { AuditLogItem } from '@/lib/audit-api';

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

interface Props {
  userId: string;
  timeline: AuditLogItem[];
  error: string | null;
}

export function UserActivityView({ userId, timeline, error }: Props): JSX.Element {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    void (async () => {
      const r = await fetch(`/api/admin/users/${userId}/sessions`, { cache: 'no-store' });
      const body = await r.json().catch(() => ({}));
      if (aborted) return;
      if (!r.ok) {
        setSessionError(body?.message ?? 'Falha ao carregar sessões');
        return;
      }
      setSessions(body as SessionItem[]);
    })();
    return () => {
      aborted = true;
    };
  }, [userId]);

  async function revoke(sessionId: string): Promise<void> {
    setBusyId(sessionId);
    try {
      const r = await fetch(`/api/admin/users/${userId}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setToast({ tone: 'error', message: body?.message ?? 'Falha ao revogar sessão' });
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setToast({ tone: 'success', message: 'Sessão revogada' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Atividade do usuário</h1>
        <p className="text-sm text-ash">
          ID: <code className="text-xs">{userId}</code>
        </p>
      </header>

      {toast ? (
        <div
          role="status"
          className={cn(
            'rounded-md border p-3 text-sm',
            toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200',
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="text-sm font-medium">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {error ? (
              <p className="text-sm text-red-200">{error}</p>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-ash">Sem ações registradas para este usuário.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-white/8 pl-5">
                {timeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 inline-block h-2 w-2 rounded-full bg-sky-400 ring-4 ring-card" />
                    <div className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Badge className="border border-white/8 bg-white/[0.02] font-mono text-[11px]">
                        {event.action}
                      </Badge>
                      <span className="text-xs text-ash">{event.module}</span>
                      <span className="text-xs text-ash">·</span>
                      <span className="text-xs text-ash">
                        {new Date(event.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {event.resourceId ? (
                      <div className="mt-1 text-xs text-ash">
                        recurso: <code>{event.resourceId}</code>
                      </div>
                    ) : null}
                    {event.ipAddress ? (
                      <div className="text-xs text-ash">
                        IP: <code>{event.ipAddress}</code>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="text-sm font-medium">Sessões ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {sessionError ? (
              <p className="text-sm text-red-200">{sessionError}</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-ash">Sem sessões ativas.</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border border-white/8 bg-white/[0.02] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="text-xs text-white">{s.id.slice(0, 8)}…</code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => revoke(s.id)}
                      loading={busyId === s.id}
                    >
                      Revogar
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ash">
                    <span>IP</span>
                    <code className="text-right text-white/90">{s.ipAddress ?? '—'}</code>
                    <span>Device</span>
                    <span className="truncate text-right text-white/90" title={s.userAgent ?? ''}>
                      {s.userAgent?.split(' ')[0] ?? '—'}
                    </span>
                    <span>Aberta em</span>
                    <span className="text-right text-white/90">
                      {new Date(s.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
