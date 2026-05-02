'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@devtechs/ui';

import {
  TICKET_STATUSES,
  type TicketStatus,
  type TicketUserDto,
} from '@/lib/support-api';

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em andamento',
  WAITING_CLIENT: 'Aguardando cliente',
  RESOLVED: 'Resolvido',
  CLOSED: 'Encerrado',
};

interface Props {
  ticketId: string;
  currentStatus: TicketStatus;
  assignee: TicketUserDto | null;
  currentUserId: string;
  accessToken: string;
}

export function AgentActions({
  ticketId,
  currentStatus,
  assignee,
  currentUserId,
  accessToken,
}: Props): JSX.Element {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const supportUrl =
    process.env.NEXT_PUBLIC_SUPPORT_URL ?? 'http://127.0.0.1:4008';

  async function callApi(
    path: string,
    method: 'PUT' | 'POST',
    body?: unknown,
  ): Promise<boolean> {
    const res = await fetch(`${supportUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      const message = Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message ?? 'Falha na operação';
      setError(message);
      return false;
    }
    setError(null);
    return true;
  }

  function changeStatus(next: TicketStatus): void {
    startTransition(async () => {
      const ok = await callApi(`/tickets/${ticketId}/status`, 'PUT', {
        status: next,
      });
      if (ok) router.refresh();
    });
  }

  function takeOver(): void {
    startTransition(async () => {
      const ok = await callApi(`/tickets/${ticketId}/assign`, 'PUT', {
        assigneeId: currentUserId,
      });
      if (ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.04] p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Ações do agente
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-ash">
            Atribuição
          </label>
          {assignee ? (
            <p className="mt-1 text-sm text-foreground">
              {assignee.name ?? assignee.email}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ash">
              Sem responsável
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || assignee?.id === currentUserId}
            onClick={takeOver}
            className="mt-2 w-full"
          >
            {assignee?.id === currentUserId
              ? 'Já é seu chamado'
              : 'Assumir este chamado'}
          </Button>
        </div>

        <div>
          <label
            htmlFor="agent-status"
            className="block text-xs text-ash"
          >
            Mudar status
          </label>
          <select
            id="agent-status"
            value={currentStatus}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as TicketStatus;
              if (next !== currentStatus) changeStatus(next);
            }}
            className="mt-1 w-full rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
