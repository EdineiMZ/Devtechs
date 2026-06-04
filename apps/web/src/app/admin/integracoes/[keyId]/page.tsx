import { notFound, redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { fmtDateTime } from '@/lib/fmt-date';
import {
  getApiKey,
  getApiKeyAuditLogs,
  getApiKeyMetrics,
  type ApiKey,
  type ApiKeyAuditLog,
  type ApiKeyStatus,
  type Metrics,
} from '@/lib/api-keys-api';

import { EditKeyDialog } from './_components/edit-key-dialog';
import { RequestsChart } from './_components/requests-chart';
import { RevokeDialog } from './_components/revoke-dialog';

export const dynamic = 'force-dynamic';

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}): JSX.Element {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <p className="text-xs font-medium text-ash">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${accent ?? 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<ApiKeyStatus, string> = {
  ACTIVE: 'Ativo',
  REVOKED: 'Revogado',
  SUSPENDED: 'Suspenso',
  EXPIRED: 'Expirado',
};

const STATUS_CLASS: Record<ApiKeyStatus, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  REVOKED: 'bg-red-500/15 text-red-400',
  SUSPENDED: 'bg-amber-500/15 text-amber-400',
  EXPIRED: 'bg-white/10 text-ash',
};

const EVENT_LABEL: Record<string, string> = {
  REQUEST_OK: 'OK',
  BLOCKED_IP: 'IP Bloqueado',
  RATE_LIMITED: 'Rate Limited',
  KEY_CREATED: 'Criada',
  KEY_REVOKED: 'Revogada',
};

const EVENT_CLASS: Record<string, string> = {
  REQUEST_OK: 'text-emerald-400',
  BLOCKED_IP: 'text-red-400',
  RATE_LIMITED: 'text-amber-400',
  KEY_CREATED: 'text-sky-400',
  KEY_REVOKED: 'text-red-400',
};

interface PageProps {
  params: { keyId: string };
}

export default async function ApiKeyDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/admin/integracoes/${params.keyId}`);
  if (!session.accessToken) redirect(`/login?callbackUrl=/admin/integracoes/${params.keyId}`);

  const { user } = session;
  if (!user.permissions.includes('integrations:manage')) redirect('/perfil');

  const [keyRes, logsRes, metricsRes] = await Promise.all([
    getApiKey(params.keyId, session.accessToken).catch(() => ({ ok: false, data: null })),
    getApiKeyAuditLogs(params.keyId, { pageSize: 50 }, session.accessToken).catch(() => ({
      ok: false,
      data: [],
    })),
    getApiKeyMetrics(params.keyId, session.accessToken).catch(() => ({ ok: false, data: null })),
  ]);

  if (!keyRes.ok || !keyRes.data) notFound();

  const key = keyRes.data as ApiKey;
  const logs: ApiKeyAuditLog[] =
    logsRes.ok && Array.isArray(logsRes.data) ? (logsRes.data as ApiKeyAuditLog[]) : [];
  const metrics = metricsRes.ok && metricsRes.data ? (metricsRes.data as Metrics) : null;

  return (
    <AppShell
      pathname="/admin/integracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Integrações', href: '/admin/integracoes' },
        { label: key.name },
      ]}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{key.name}</h1>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[key.status]}`}
            >
              {STATUS_LABEL[key.status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-ash">{key.keyPrefix}</p>
        </div>
        <div className="flex gap-2">
          {key.status !== 'REVOKED' && (
            <>
              <EditKeyDialog apiKey={key} />
              <RevokeDialog keyId={key.id} keyName={key.name} />
            </>
          )}
        </div>
      </div>

      {/* Revoke reason banner */}
      {key.status === 'REVOKED' && key.revokeReason && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          <span className="font-semibold">Motivo da revogação:</span> {key.revokeReason}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de requisições"
          value={(metrics?.totalRequests ?? key.totalRequests).toLocaleString('pt-BR')}
          accent="text-sky-400"
        />
        <StatCard
          label="Requisições hoje"
          value={(metrics?.requestsToday ?? 0).toLocaleString('pt-BR')}
          accent="text-emerald-400"
        />
        <StatCard
          label="Último IP"
          value={metrics?.lastUsedIp ?? key.lastUsedIp ?? '—'}
        />
        <StatCard
          label="Status"
          value={STATUS_LABEL[key.status]}
          accent={
            key.status === 'ACTIVE'
              ? 'text-emerald-400'
              : key.status === 'REVOKED'
              ? 'text-destructive'
              : key.status === 'SUSPENDED'
              ? 'text-amber-400'
              : 'text-ash'
          }
        />
      </div>

      {/* Requests chart */}
      {metrics && metrics.requestsByHour.length > 0 && (
        <div className="mb-8 rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">
            Requisições por hora (últimas 24h)
          </p>
          <RequestsChart data={metrics.requestsByHour} />
        </div>
      )}

      {/* Details grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Permissões */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Permissões</p>
          <div className="flex flex-wrap gap-1.5">
            {key.permissions.map((p) => (
              <span
                key={p}
                className="bg-white/10 text-ash px-1.5 py-0.5 rounded text-[10px] font-mono"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Configurações */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">Configurações</p>
          <dl className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-ash">IP Binding</dt>
              <dd className="font-medium text-foreground">{key.ipBinding}</dd>
            </div>
            {key.boundIps.length > 0 && (
              <div className="flex justify-between">
                <dt className="text-ash">IPs vinculados</dt>
                <dd className="font-mono text-foreground">{key.boundIps.join(', ')}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ash">Rate limit/min</dt>
              <dd className="text-foreground">{key.rateLimit.perMinute}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">Rate limit/hora</dt>
              <dd className="text-foreground">{key.rateLimit.perHour}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">Rate limit/dia</dt>
              <dd className="text-foreground">{key.rateLimit.perDay}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">Criada em</dt>
              <dd className="text-foreground">{fmtDateTime(key.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">Expira em</dt>
              <dd className="text-foreground">{key.expiresAt ? fmtDateTime(key.expiresAt) : 'Sem expiração'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ash">Último uso</dt>
              <dd className="text-foreground">{fmtDateTime(key.lastUsedAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Audit log */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-foreground">Log de auditoria</h2>
        {logs.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm text-ash">Nenhum evento registrado.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-ash">Evento</th>
                    <th className="px-4 py-3 text-xs font-medium text-ash">IP</th>
                    <th className="px-4 py-3 text-xs font-medium text-ash">Endpoint</th>
                    <th className="px-4 py-3 text-xs font-medium text-ash">Status</th>
                    <th className="px-4 py-3 text-xs font-medium text-ash">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs font-medium ${EVENT_CLASS[log.event] ?? 'text-ash'}`}
                        >
                          {EVENT_LABEL[log.event] ?? log.event}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-ash">{log.ip ?? '—'}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-ash">
                          {log.endpoint ?? '—'}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ash">
                        {log.statusCode ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ash">
                        {fmtDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
