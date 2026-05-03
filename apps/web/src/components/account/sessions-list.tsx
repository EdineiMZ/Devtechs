'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

import type { AccountSession } from '@/lib/account-api';

/**
 * Active-session list. The server component fetches the initial
 * snapshot; this client component handles "encerrar sessão" and
 * keeps an optimistic local copy so the row vanishes immediately.
 *
 * The "current" session is rendered with a green pill and no
 * revoke button — the backend rejects DELETE on the current
 * session anyway (use the topbar "Sair" instead).
 */
export function SessionsList({
  initialSessions,
}: {
  initialSessions: AccountSession[];
}): JSX.Element {
  const [sessions, setSessions] = useState<AccountSession[]>(initialSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string): Promise<void> {
    setError(null);
    setRevokingId(id);
    // Optimistic: drop the row, restore on failure.
    const prev = sessions;
    setSessions(prev.filter((s) => s.id !== id));
    const res = await fetch(`/api/account/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const fallback = 'Não foi possível encerrar essa sessão.';
      const msg = Array.isArray(data.message)
        ? (data.message[0] ?? fallback)
        : (data.message ?? fallback);
      setSessions(prev);
      setError(msg);
    }
    setRevokingId(null);
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] p-6 text-center text-sm text-ash">
        Nenhuma sessão ativa encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3 sm:gap-4"
            data-testid={`session-row-${s.id}`}
          >
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {s.device}
                </span>
                {s.current ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                    Sessão atual
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-ash">
                {s.ipAddress ? `IP ${s.ipAddress} · ` : ''}
                Última atividade {formatRelative(s.lastSeenAt ?? s.createdAt)}
              </div>
            </div>

            {s.current ? (
              <span className="text-xs text-ash">
                Use o botão &quot;Sair&quot; para encerrar.
              </span>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={revokingId === s.id}
                disabled={revokingId !== null}
                onClick={() => revoke(s.id)}
                aria-label={`Encerrar sessão ${s.device}`}
              >
                Encerrar sessão
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const RELATIVE_FORMATTER =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
    : null;

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const sec = Math.round(ms / 1000);
  if (!RELATIVE_FORMATTER) return `há ${Math.max(1, Math.round(sec / 60))} min`;
  if (sec < 60) return RELATIVE_FORMATTER.format(-sec, 'second');
  const min = Math.round(sec / 60);
  if (min < 60) return RELATIVE_FORMATTER.format(-min, 'minute');
  const hr = Math.round(min / 60);
  if (hr < 24) return RELATIVE_FORMATTER.format(-hr, 'hour');
  const days = Math.round(hr / 24);
  return RELATIVE_FORMATTER.format(-days, 'day');
}
