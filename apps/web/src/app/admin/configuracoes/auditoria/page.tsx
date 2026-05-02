import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { getAuditStats, listAuditLogs } from '@/lib/audit-api';
import type { AuditCursorPage, AuditStats } from '@/lib/audit-api';

export const dynamic = 'force-dynamic';

interface SearchParams {
  action?: string;
  module?: string;
  userId?: string;
  cursor?: string;
  from?: string;
  to?: string;
  period?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function actionBadge(action: string): JSX.Element {
  const lower = action.toLowerCase();
  const isError =
    lower.includes('fail') || lower.includes('error') || lower.includes('forbidden') || lower.includes('denied');
  const isSuccess =
    lower.includes('success') || lower.includes('creat') || lower.includes('login') && !isError;

  if (isError) {
    return (
      <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-red-400">
        {action}
      </span>
    );
  }
  if (isSuccess) {
    return (
      <span className="rounded border border-acid/20 bg-acid/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-acid">
        {action}
      </span>
    );
  }
  return (
    <span className="rounded border border-copper/20 bg-copper/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-copper">
      {action}
    </span>
  );
}

function moduleBadge(module: string): JSX.Element {
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-ash/70">
      {module}
    </span>
  );
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes/auditoria');
  const user = session.user;
  if (!user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const now = new Date();
  const period = searchParams.period ?? '7d';

  const periodDays: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30 };
  const days = searchParams.from ? null : (periodDays[period] ?? 7);

  const defaultFrom = days
    ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : (searchParams.from ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const defaultTo = searchParams.to ?? now.toISOString().slice(0, 10);

  const [logsRes, statsRes] = await Promise.all([
    listAuditLogs({
      dateFrom: defaultFrom,
      dateTo: defaultTo,
      action: searchParams.action,
      module: searchParams.module,
      userId: searchParams.userId,
      cursor: searchParams.cursor,
      pageSize: 50,
    }),
    getAuditStats(),
  ]);

  const logsData = logsRes.ok ? (logsRes.data as AuditCursorPage) : null;
  const stats    = statsRes.ok ? (statsRes.data as AuditStats) : null;
  const logs     = logsData?.items ?? [];

  const totalEvents  = logs.length;
  const loginsToday  = stats?.loginsByHour.reduce((s, h) => s + h.count, 0) ?? 0;
  const totalErrors  = stats?.modulesWithErrors.reduce((s, m) => s + m.errors, 0) ?? 0;
  const activeUsers  = stats?.topUsers.length ?? 0;

  const STAT_CARDS = [
    { label: 'Eventos no período', value: totalEvents,  accent: 'text-foreground' },
    { label: 'Logins hoje',        value: loginsToday,  accent: 'text-acid'       },
    { label: 'Erros hoje',         value: totalErrors,  accent: 'text-red-400'    },
    { label: 'Usuários ativos',    value: activeUsers,  accent: 'text-copper'     },
  ];

  const PERIOD_OPTS = [
    { value: '1d',     label: 'Hoje (24h)'   },
    { value: '7d',     label: 'Últimos 7 dias' },
    { value: '30d',    label: 'Últimos 30 dias' },
    { value: 'custom', label: 'Personalizado'   },
  ];

  const isCustom = period === 'custom' || searchParams.from;

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações', href: '/admin/configuracoes' },
        { label: 'Auditoria' },
      ]}
    >
      {/* ── Header ── */}
      <header className="mb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
          {'// auditoria'}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Auditoria global
        </h1>
        <p className="mt-1 font-body text-sm text-ash">
          Logs imutáveis de todas as ações sensíveis emitidas pelos serviços.
        </p>
      </header>

      {/* ── Stat cards ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
              {card.label}
            </p>
            <p className={`mt-2 font-display text-3xl font-semibold ${card.accent}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Activity + Top actions ── */}
      {stats && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Activity sparkline */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <p className="mb-4 font-display text-xs font-semibold text-foreground">
              Atividade — últimos 30 dias
            </p>
            {stats.loginsByHour.length > 0 ? (
              <div className="flex h-20 items-end gap-0.5">
                {stats.loginsByHour.map((h, i) => {
                  const max = Math.max(...stats.loginsByHour.map((x) => x.count), 1);
                  const pct = Math.max((h.count / max) * 100, 4);
                  return (
                    <div
                      key={i}
                      title={`${h.hour}: ${h.count}`}
                      style={{ height: `${pct}%` }}
                      className="flex-1 rounded-sm bg-copper/40 transition-all hover:bg-copper"
                    />
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center font-body text-xs text-ash/50">Sem dados de atividade</p>
            )}
          </div>

          {/* Top actions + modules with errors */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <p className="mb-3 font-display text-xs font-semibold text-foreground">Top ações (7d)</p>
            <div className="mb-4 space-y-1.5">
              {stats.topActions.slice(0, 5).map((a) => (
                <div key={a.action} className="flex items-center justify-between">
                  {actionBadge(a.action)}
                  <span className="font-mono text-[11px] text-ash">{a.count}</span>
                </div>
              ))}
            </div>

            {stats.modulesWithErrors.length > 0 && (
              <>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
                  Módulos com erros (7d)
                </p>
                <div className="space-y-1.5">
                  {stats.modulesWithErrors.map((m) => (
                    <div key={m.module} className="flex items-center justify-between">
                      <span className="font-mono text-xs text-ash">{m.module}</span>
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] text-red-400">
                        {m.errors}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <form className="mb-4 space-y-3">
        {/* Period buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">
            Período
          </span>
          <div className="flex gap-1">
            {PERIOD_OPTS.map((opt) => {
              const active = isCustom ? opt.value === 'custom' : period === opt.value;
              return (
                <a
                  key={opt.value}
                  href={
                    opt.value === 'custom'
                      ? '#'
                      : `/admin/configuracoes/auditoria?period=${opt.value}${searchParams.action ? `&action=${searchParams.action}` : ''}${searchParams.module ? `&module=${searchParams.module}` : ''}`
                  }
                  className={`rounded-lg border px-3 py-1.5 font-body text-xs font-medium transition-colors ${
                    active
                      ? 'border-copper/40 bg-copper/10 text-copper'
                      : 'border-white/8 bg-white/[0.02] text-ash hover:border-copper/20 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Filter inputs */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Módulo</label>
            <select
              name="module"
              defaultValue={searchParams.module ?? ''}
              className="rounded-lg border border-white/8 bg-ink px-3 py-2 font-body text-sm text-foreground focus:border-copper/40 focus:outline-none"
            >
              <option value="">Todos</option>
              {['AUTH', 'RH', 'FINANCEIRO', 'PROJETOS', 'SUPORTE', 'DEVOPS', 'DEVELOPER'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Ação contém</label>
            <input
              name="action"
              defaultValue={searchParams.action ?? ''}
              placeholder="ex: LOGIN_FAILED"
              className="rounded-lg border border-white/8 bg-ink px-3 py-2 font-body text-sm text-foreground placeholder:text-ash/30 focus:border-copper/40 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-ash/50">User ID</label>
            <input
              name="userId"
              defaultValue={searchParams.userId ?? ''}
              placeholder="cuid..."
              className="rounded-lg border border-white/8 bg-ink px-3 py-2 font-body text-sm text-foreground placeholder:text-ash/30 focus:border-copper/40 focus:outline-none"
            />
          </div>

          {isCustom && (
            <>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-ash/50">De</label>
                <input
                  name="from"
                  type="date"
                  defaultValue={defaultFrom}
                  className="rounded-lg border border-white/8 bg-ink px-3 py-2 font-body text-sm text-foreground focus:border-copper/40 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-ash/50">Até</label>
                <input
                  name="to"
                  type="date"
                  defaultValue={defaultTo}
                  className="rounded-lg border border-white/8 bg-ink px-3 py-2 font-body text-sm text-foreground focus:border-copper/40 focus:outline-none"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="rounded-lg border border-copper/30 bg-copper/8 px-4 py-2 font-body text-sm font-medium text-copper transition-colors hover:border-copper/50 hover:bg-copper/12"
          >
            Aplicar filtros
          </button>

          <a
            href={`/admin/configuracoes/auditoria?period=${period}&from=${defaultFrom}&to=${defaultTo}${searchParams.action ? `&action=${searchParams.action}` : ''}${searchParams.module ? `&module=${searchParams.module}` : ''}&export=csv`}
            className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2 font-body text-sm font-medium text-ash transition-colors hover:border-white/20 hover:text-foreground"
          >
            Exportar CSV
          </a>
        </div>
      </form>

      {/* ── Log table ── */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {logs.length === 0 ? (
          <p className="p-10 text-center font-body text-sm text-ash">
            Nenhuma entrada de auditoria no período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">Quando</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">Usuário</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">Ação</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">Módulo</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">Recurso</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-ash/50">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {logs.map((log) => (
                  <tr key={log.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-ash/70">
                      {relativeTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.userId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-copper/20 font-mono text-[9px] font-bold text-copper">
                            {log.userId.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-mono text-[11px] text-ash/70">
                            {log.userId.slice(0, 8)}…
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-ash/40">sistema</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{actionBadge(log.action)}</td>
                    <td className="px-4 py-2.5">{moduleBadge(log.module)}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-ash/50">
                      {log.resourceId ? `${log.resourceId.slice(0, 12)}…` : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-ash/50">
                      {log.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {logsData?.nextCursor && (
          <div className="border-t border-white/8 px-4 py-3">
            <a
              href={`/admin/configuracoes/auditoria?period=${period}&from=${defaultFrom}&to=${defaultTo}&cursor=${logsData.nextCursor}`}
              className="font-mono text-[11px] text-copper hover:underline"
            >
              Carregar próxima página →
            </a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
