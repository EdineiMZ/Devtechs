'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { Button, cn } from '@devtechs/ui';

import type { AuditCursorPage, AuditLogItem, AuditStats } from '@/lib/audit-api';

const MODULES = ['', 'AUTH', 'RH', 'FINANCEIRO', 'PROJETOS', 'SUPORTE', 'PAGAMENTOS', 'LICENCAS', 'DEVOPS', 'DEVELOPER'];
const PERIODS = [
  { id: '24h', label: 'Hoje (24h)', days: 1 },
  { id: '7d', label: 'Últimos 7 dias', days: 7 },
  { id: '30d', label: 'Últimos 30 dias', days: 30 },
  { id: 'custom', label: 'Personalizado', days: 0 },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

interface Props {
  initialPage: AuditCursorPage;
  initialStats: AuditStats;
  defaultDateFrom: string;
  defaultDateTo: string;
  canViewSecurity: boolean;
  error: string | null;
}

export function AuditPanel({
  initialPage,
  initialStats: stats,
  defaultDateFrom,
  defaultDateTo,
  canViewSecurity,
  error: initialError,
}: Props): JSX.Element {
  const [period, setPeriod] = useState<PeriodId>('7d');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const [items, setItems] = useState<AuditLogItem[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [error, setError] = useState<string | null>(initialError);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayItems = items.filter((i) => new Date(i.createdAt) >= todayStart);
    const loginsToday = todayItems.filter((i) => i.action === 'LOGIN_SUCCESS').length;
    const errorsToday = todayItems.filter(
      (i) =>
        i.action.includes('FAILED') ||
        i.action.includes('BLOCKED') ||
        i.action.includes('DENIED'),
    ).length;
    const activeUsers = new Set(items.filter((i) => i.userId).map((i) => i.userId)).size;
    return {
      total: items.length,
      loginsToday,
      errorsToday,
      activeUsers,
    };
  }, [items]);

  const dailyActivity = useMemo(() => {
    const days = 30;
    const out: Array<{ day: string; count: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = items.filter((it) => {
        const ts = new Date(it.createdAt);
        return ts >= d && ts < next;
      }).length;
      out.push({ day: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, count });
    }
    return out;
  }, [items]);

  function applyPeriod(id: PeriodId): void {
    const cfg = PERIODS.find((p) => p.id === id);
    if (!cfg) return;
    setPeriod(id);
    if (cfg.days > 0) {
      const to = new Date();
      const from = new Date(to.getTime() - cfg.days * 24 * 60 * 60 * 1000);
      setDateFrom(from.toISOString());
      setDateTo(to.toISOString());
    }
  }

  async function reload(opts: { append?: boolean; cursor?: string } = {}): Promise<void> {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      pageSize: '50',
    });
    if (moduleFilter) params.set('module', moduleFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter) params.set('userId', userFilter);
    if (opts.cursor) params.set('cursor', opts.cursor);

    const res = await fetch(`/api/admin/audit/logs?${params.toString()}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body?.message ?? 'Falha ao carregar logs');
      return;
    }
    setError(null);
    const page = body as AuditCursorPage;
    setItems((prev) => (opts.append ? [...prev, ...page.items] : page.items));
    setNextCursor(page.nextCursor);
  }

  function exportCsv(): void {
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (moduleFilter) params.set('module', moduleFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (userFilter) params.set('userId', userFilter);
    window.location.href = `/api/admin/audit/export?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Auditoria global</h1>
        <p className="text-sm text-ash">
          Logs imutáveis de todas as ações sensíveis emitidas pelos serviços.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Eventos no período" value={summary.total} />
        <SummaryCard label="Logins hoje" value={summary.loginsToday} accent="emerald" />
        <SummaryCard label="Erros hoje" value={summary.errorsToday} accent={summary.errorsToday > 0 ? 'red' : 'slate'} />
        <SummaryCard label="Usuários ativos" value={summary.activeUsers} accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-medium text-white">Atividade — últimos 30 dias</p>
          </div>
          <div className="px-4 pb-4">
            <BarChart data={dailyActivity} />
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.02]">
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-medium text-white">Top ações (7d)</p>
          </div>
          <div className="space-y-1.5 px-4 pb-4">
            {stats.topActions.length === 0 ? (
              <p className="text-xs text-ash">Sem dados.</p>
            ) : (
              stats.topActions.slice(0, 8).map((row) => (
                <div key={row.action} className="flex items-center justify-between gap-3 text-sm">
                  <ActionBadge action={row.action} />
                  <span className="text-xs text-ash">{row.count}</span>
                </div>
              ))
            )}
            {stats.modulesWithErrors.length > 0 ? (
              <>
                <div className="mt-3 text-[11px] uppercase tracking-wider text-ash">
                  Módulos com erros (7d)
                </div>
                {stats.modulesWithErrors.slice(0, 5).map((m) => (
                  <div key={m.module} className="flex items-center justify-between text-sm">
                    <span>{m.module}</span>
                    <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[11px] text-red-200">
                      {m.errors}
                    </span>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        <div className="border-b border-white/8 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-ash">Período</label>
              <div className="mt-1 flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPeriod(p.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs',
                      period === p.id
                        ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                        : 'border-white/8 bg-white/[0.02] text-ash hover:text-white',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <FilterField label="Módulo">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-9 rounded-md border border-white/8 bg-white/[0.02] px-2 text-sm text-white outline-none focus:border-sky-500/60"
              >
                {MODULES.map((m) => (
                  <option key={m} value={m}>
                    {m === '' ? 'Todos' : m}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Ação contém">
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                placeholder="ex: LOGIN_FAILED"
                className="h-9 w-48 rounded-md border border-white/8 bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-sky-500/60"
              />
            </FilterField>
            <FilterField label="User ID">
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="cuid…"
                className="h-9 w-56 rounded-md border border-white/8 bg-white/[0.02] px-3 text-sm text-white outline-none focus:border-sky-500/60"
              />
            </FilterField>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => startTransition(() => void reload())}
                loading={pending}
              >
                Aplicar filtros
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
                Exportar CSV
              </Button>
              {canViewSecurity ? (
                <Link href="/admin/auditoria/seguranca">
                  <Button type="button" size="sm" variant="outline">
                    Relatório de segurança
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-0 py-0">
          {error ? (
            <div className="border-b border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
          ) : null}

          {items.length === 0 ? (
            <p className="p-6 text-sm text-ash">Nenhum evento no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-ash">
                  <tr>
                    <th className="px-4 py-2 font-medium">Quando</th>
                    <th className="px-4 py-2 font-medium">Usuário</th>
                    <th className="px-4 py-2 font-medium">Ação</th>
                    <th className="px-4 py-2 font-medium">Módulo</th>
                    <th className="px-4 py-2 font-medium">Recurso</th>
                    <th className="px-4 py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="cursor-pointer border-b border-white/8 transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-2 text-ash">{relative(row.createdAt)}</td>
                      <td className="px-4 py-2">
                        {row.userId ? (
                          <Link
                            href={`/admin/usuarios/${row.userId}/atividade`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sky-300 hover:underline"
                          >
                            <UserAvatar userId={row.userId} />
                          </Link>
                        ) : (
                          <span className="text-ash">sistema</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <ActionBadge action={row.action} />
                      </td>
                      <td className="px-4 py-2 text-ash">{row.module}</td>
                      <td className="px-4 py-2 text-ash">
                        {row.resourceId ? <code className="text-xs">{row.resourceId}</code> : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-xs text-ash">{row.ipAddress ?? '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor ? (
            <div className="flex justify-center border-t border-white/8 p-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => startTransition(() => void reload({ append: true, cursor: nextCursor }))}
                loading={pending}
              >
                Carregar mais
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {selected ? <DetailModal entry={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  accent = 'slate',
}: {
  label: string;
  value: number;
  accent?: 'slate' | 'sky' | 'emerald' | 'red';
}): JSX.Element {
  const accents: Record<typeof accent, string> = {
    slate: 'text-white',
    sky: 'text-sky-300',
    emerald: 'text-emerald-300',
    red: 'text-red-300',
  };
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4">
      <div className="text-[11px] uppercase tracking-wider text-ash">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold', accents[accent])}>{value}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-ash">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }): JSX.Element {
  const tone =
    action.includes('FAILED') || action.includes('BLOCKED') || action.includes('DENIED')
      ? 'border-red-500/30 bg-red-500/15 text-red-200'
      : action.includes('CREATE') || action.includes('REGISTER')
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
        : action.includes('DELETE') || action.includes('REVOKE') || action.includes('REMOVE')
          ? 'border-amber-500/30 bg-amber-500/15 text-amber-200'
          : 'border-sky-500/30 bg-sky-500/15 text-sky-200';
  return <span className={cn('inline-block rounded border px-1.5 py-0.5 font-mono text-[11px]', tone)}>{action}</span>;
}

function UserAvatar({ userId }: { userId: string }): JSX.Element {
  // No avatar source yet — derive a stable colored monogram from the cuid.
  const seed = userId.charCodeAt(2) * 7 + userId.charCodeAt(5);
  const hue = seed % 360;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-slate-950"
        style={{ background: `hsl(${hue} 70% 65%)` }}
      >
        {userId.slice(-2).toUpperCase()}
      </span>
      <code className="text-xs">{userId.slice(0, 8)}…</code>
    </span>
  );
}

function relative(iso: string): string {
  const ts = new Date(iso).getTime();
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `há ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `há ${day}d`;
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Pure-SVG bar chart for the daily-activity widget. */
function BarChart({ data }: { data: Array<{ day: string; count: number }> }): JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 720;
  const H = 160;
  const PAD_X = 28;
  const PAD_Y = 18;
  const barWidth = (W - PAD_X * 2) / data.length - 2;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Atividade diária últimos 30 dias">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={H - PAD_Y - p * (H - PAD_Y * 2)}
            y2={H - PAD_Y - p * (H - PAD_Y * 2)}
            stroke="rgb(148 163 184 / 0.12)"
            strokeDasharray="2 4"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.count / max) * (H - PAD_Y * 2);
          const x = PAD_X + i * ((W - PAD_X * 2) / data.length);
          const y = H - PAD_Y - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={h} fill="rgb(56 189 248 / 0.55)" rx={2}>
                <title>{`${d.day}: ${d.count}`}</title>
              </rect>
              {i % 5 === 0 ? (
                <text x={x + barWidth / 2} y={H - 4} fill="rgb(148 163 184)" fontSize="9" textAnchor="middle">
                  {d.day}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DetailModal({ entry, onClose }: { entry: AuditLogItem; onClose: () => void }): JSX.Element {
  const meta = JSON.stringify(entry.meta, null, 2);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl border border-white/8 bg-[#0d1117]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
          <div>
            <ActionBadge action={entry.action} />
            <p className="mt-1 text-xs text-ash">
              {new Date(entry.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md border border-white/8 bg-white/[0.02] px-2 py-1 text-xs text-ash hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <Field label="ID do evento">
            <code>{entry.id}</code>
          </Field>
          <Field label="Usuário">
            {entry.userId ? (
              <Link href={`/admin/usuarios/${entry.userId}/atividade`} className="text-sky-300 hover:underline">
                {entry.userId}
              </Link>
            ) : (
              <span className="text-ash">sistema</span>
            )}
          </Field>
          <Field label="Módulo">{entry.module}</Field>
          <Field label="Recurso">{entry.resourceId ?? '—'}</Field>
          <Field label="IP">
            <code>{entry.ipAddress ?? '—'}</code>
          </Field>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ash">Meta</div>
            <pre className="mt-1 max-h-72 overflow-auto rounded-md border border-white/8 bg-black/40 p-3 font-mono text-xs leading-relaxed text-emerald-200">
{meta}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-2">
      <span className="text-[11px] uppercase tracking-wider text-ash">{label}</span>
      <span>{children}</span>
    </div>
  );
}
