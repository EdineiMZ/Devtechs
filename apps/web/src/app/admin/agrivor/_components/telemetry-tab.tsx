'use client';

import { Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@szdevs/ui';
import { useEffect, useState } from 'react';

import type { AgrivorTelemetry } from '@/lib/agrivor-api';

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

function fmtCountdown(iso: string | null): string {
  if (!iso) return '—';
  const remaining = new Date(iso).getTime() - Date.now();
  if (remaining <= 0) return 'Expirado';
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export function TelemetryTab(): JSX.Element {
  const [telemetry, setTelemetry] = useState<AgrivorTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/admin/agrivor/telemetry');
        if (res.ok) {
          const data = (await res.json()) as AgrivorTelemetry[];
          setTelemetry(Array.isArray(data) ? data : []);
        } else {
          setError('Falha ao carregar telemetria.');
        }
      } catch {
        setError('Falha de conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Carregando telemetria…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        ⚠ {error}
      </div>
    );
  }

  if (telemetry.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center text-sm text-ash">
        Nenhum dado de telemetria disponível.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último heartbeat</TableHead>
            <TableHead>Última validação</TableHead>
            <TableHead>Grace period</TableHead>
            <TableHead>Módulos ativos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {telemetry.map((t) => (
            <TableRow key={t.customerId}>
              <TableCell className="font-mono text-xs">{t.customerId}</TableCell>
              <TableCell>
                <span
                  className={
                    'inline-flex items-center gap-1.5 text-xs font-semibold ' +
                    (t.isOnline ? 'text-emerald-400' : 'text-destructive')
                  }
                >
                  <span
                    aria-hidden="true"
                    className={
                      'inline-block h-2 w-2 rounded-full ' +
                      (t.isOnline ? 'bg-emerald-500' : 'bg-destructive')
                    }
                  />
                  {t.isOnline ? 'Online' : 'Offline'}
                </span>
              </TableCell>
              <TableCell className="text-sm">{fmtRelative(t.lastHeartbeat)}</TableCell>
              <TableCell className="text-sm">{fmtRelative(t.lastValidation)}</TableCell>
              <TableCell className="text-sm">
                {t.isOnline ? '—' : fmtCountdown(t.gracePeriodEndsAt)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {t.activeModules.length > 0 ? (
                    t.activeModules.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-ash"
                      >
                        {m}
                      </span>
                    ))
                  ) : (
                    <span className="text-ash">—</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
