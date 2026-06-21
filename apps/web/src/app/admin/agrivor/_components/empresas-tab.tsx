'use client';

import { Badge, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@szdevs/ui';
import { useEffect, useState } from 'react';

import type { AgrivorKeyStatus, AgrivorTenantKey } from '@/lib/agrivor-api';

const STATUS_VARIANT: Record<AgrivorKeyStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  EXPIRED: 'warning',
  REVOKED: 'destructive',
  PENDING: 'secondary',
};

const STATUS_LABEL: Record<AgrivorKeyStatus, string> = {
  ACTIVE: 'Ativo',
  EXPIRED: 'Expirado',
  REVOKED: 'Revogado',
  PENDING: 'Pendente',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export function EmpresasTab(): JSX.Element {
  const [tenants, setTenants] = useState<AgrivorTenantKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/agrivor/m2m/keys');
        if (res.status === 503) {
          setUnavailable(true);
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { tenants: AgrivorTenantKey[] };
          setTenants(Array.isArray(data.tenants) ? data.tenants : []);
        }
      } catch {
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" label="Carregando empresas…" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-amber-300">
        <p className="font-medium">Módulo M2M pendente (WS1)</p>
        <p className="mt-1 text-amber-300/70">
          Este painel estará disponível após o SrBackend implementar o módulo{' '}
          <code className="rounded bg-amber-500/10 px-1">api/src/m2m/</code> no AGRIVOR.
          O contrato de API foi definido em WS0.
        </p>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/[0.02] py-12 text-center text-sm text-ash">
        Nenhuma empresa encontrada.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Tenant ID</TableHead>
            <TableHead>Key (mascarada)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Módulos</TableHead>
            <TableHead>Expira em</TableHead>
            <TableHead>Último heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.map((t) => (
            <TableRow key={t.tenantId}>
              <TableCell className="font-medium text-foreground">{t.name}</TableCell>
              <TableCell className="font-mono text-xs text-ash">{t.tenantId}</TableCell>
              <TableCell className="font-mono text-xs text-ash">{t.key}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {t.modules.map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-ash"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-sm">{fmtDate(t.expiresAt)}</TableCell>
              <TableCell className="text-sm">{fmtRelative(t.lastHeartbeatAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
