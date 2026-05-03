'use client';

import { useEffect, useState } from 'react';

/**
 * Live countdown to a deadline. Re-renders every 30s — no need for
 * second-by-second precision. When the deadline has passed it flips
 * to a red overdue label.
 */
export function SlaCountdown({
  dueAt,
  resolved,
}: {
  dueAt: string | null;
  resolved?: boolean;
}): JSX.Element | null {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!dueAt || resolved) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [dueAt, resolved]);

  if (!dueAt) return null;

  const target = new Date(dueAt).getTime();
  if (Number.isNaN(target)) return null;

  if (resolved) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        SLA cumprido
      </span>
    );
  }

  const diff = target - now;
  const overdue = diff <= 0;
  const absMs = Math.abs(diff);
  const hours = Math.floor(absMs / 3_600_000);
  const minutes = Math.floor((absMs % 3_600_000) / 60_000);

  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        overdue
          ? 'text-rose-400'
          : hours < 1
            ? 'text-amber-400'
            : 'text-ash'
      }`}
      title={new Date(dueAt).toLocaleString('pt-BR')}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          overdue ? 'bg-rose-400 animate-pulse' : 'bg-current'
        }`}
      />
      {overdue ? `SLA estourou ${label}` : `SLA em ${label}`}
    </span>
  );
}
