'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@devtechs/ui';

export interface VpsListItem {
  id: string;
  vmId: string;
  label: string;
  hostname: string;
  plan: string;
  dataCenter: string;
  ipv4: string;
  notes: string | null;
  addedAt: string;
  client: { id: string; name: string; email: string };
  upstream: {
    id: string;
    state: string;
    cpuCores?: number;
    memoryMb?: number;
    diskGb?: number;
  } | null;
}

interface VpsListProps {
  initial: VpsListItem[];
  error: string | null;
}

const STATE_BADGE: Record<string, { label: string; tone: 'sky' | 'green' | 'amber' | 'red' | 'slate' }> = {
  running: { label: 'Online', tone: 'green' },
  stopped: { label: 'Desligada', tone: 'slate' },
  starting: { label: 'Iniciando', tone: 'sky' },
  stopping: { label: 'Desligando', tone: 'amber' },
  rebooting: { label: 'Reiniciando', tone: 'sky' },
};

function StateBadge({ state }: { state: string | null | undefined }): JSX.Element {
  if (!state) {
    return <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30">—</Badge>;
  }
  const cfg = STATE_BADGE[state] ?? { label: state, tone: 'slate' as const };
  const styles: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
    slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  };
  return <Badge className={cn('border', styles[cfg.tone])}>{cfg.label}</Badge>;
}

export function VpsList({ initial, error }: VpsListProps): JSX.Element {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = initial.filter((v) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        v.hostname.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        v.ipv4.includes(q) ||
        v.client.name.toLowerCase().includes(q) ||
        v.client.email.toLowerCase().includes(q)
      );
    });
    const map = new Map<string, { client: VpsListItem['client']; items: VpsListItem[] }>();
    for (const v of filtered) {
      const bucket = map.get(v.client.id);
      if (bucket) bucket.items.push(v);
      else map.set(v.client.id, { client: v.client, items: [v] });
    }
    return Array.from(map.values()).sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [initial, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">VPS Hostinger</h1>
          <p className="text-sm text-ash">
            {initial.length} VPS{initial.length === 1 ? '' : 's'} vinculadas a {grouped.length} cliente
            {grouped.length === 1 ? '' : 's'}.
          </p>
        </div>
        <input
          type="search"
          placeholder="Buscar por hostname, IP, cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-72 rounded-md border border-white/8 bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-sky-500/60"
        />
      </header>

      {error ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4 text-sm text-red-300">
            <strong className="font-semibold">Falha ao carregar:</strong> {error}
          </CardContent>
        </Card>
      ) : null}

      {grouped.length === 0 && !error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ash">
            Nenhuma VPS vinculada ainda. Use o endpoint <code>POST /vps</code> ou a CLI para vincular um
            VM da Hostinger a um cliente.
          </CardContent>
        </Card>
      ) : null}

      {grouped.map(({ client, items }) => (
        <Card key={client.id}>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="flex items-baseline justify-between gap-3">
              <span>{client.name}</span>
              <span className="text-xs font-normal text-ash">{client.email}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((v) => (
              <Link
                key={v.id}
                href={`/admin/developer/vps/${v.id}`}
                className="group flex flex-col gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-4 transition hover:border-sky-500/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{v.label}</div>
                    <div className="text-xs text-ash">{v.hostname}</div>
                  </div>
                  <StateBadge state={v.upstream?.state} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ash">
                  <span>IP</span>
                  <code className="text-right text-white/90">{v.ipv4}</code>
                  <span>Plano</span>
                  <span className="text-right text-white/90">{v.plan}</span>
                  <span>Datacenter</span>
                  <span className="text-right text-white/90">{v.dataCenter}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
