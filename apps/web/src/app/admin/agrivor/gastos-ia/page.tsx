import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import {
  currentPeriod,
  fetchAiBillingTenants,
  type TenantAiSpendingRow,
} from '@/lib/agrivor-api';

import { AiSpendingChart } from './_components/ai-spending-chart';

export const dynamic = 'force-dynamic';

const fmtBrl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

function QuotaBar({ percent, blocked }: { percent: number; blocked: boolean }): JSX.Element {
  const capped = Math.min(percent, 100);
  const color =
    blocked || percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${capped}%` }} />
      </div>
      <span className="font-mono text-xs text-ash">{percent}%</span>
    </div>
  );
}

function StatusBadge({ row }: { row: TenantAiSpendingRow }): JSX.Element {
  if (row.hardBlock && row.percentUsed >= 100) {
    return (
      <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
        Bloqueado
      </span>
    );
  }
  if (row.percentUsed >= 80) {
    return (
      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
        Alerta
      </span>
    );
  }
  return (
    <span className="rounded border border-emerald-500/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
      OK
    </span>
  );
}

export default async function GastosIaPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/agrivor/gastos-ia');
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/agrivor/gastos-ia');

  const user = session.user as typeof session.user & { permissions: string[] };
  if (!user.permissions.includes('agrivor:report:view')) redirect('/admin');

  const period = currentPeriod();
  const tenants = await fetchAiBillingTenants();
  const tenantList = tenants ?? [];

  const totalCents = tenantList.reduce((s, t) => s + t.consumedCents, 0);
  const alertCount = tenantList.filter((t) => t.percentUsed >= 80 && t.percentUsed < 100).length;
  const blockedCount = tenantList.filter((t) => t.hardBlock && t.percentUsed >= 100).length;
  const apiUnavailable = tenants === null;

  return (
    <AppShell
      pathname="/admin/agrivor/gastos-ia"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'AGRIVOR', href: '/admin/agrivor' },
        { label: 'Gastos de IA' },
      ]}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-copper">
            AGRIVOR · Gastos de IA
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Consumo por empresa
          </h1>
          <p className="mt-1 text-sm text-ash">
            Gasto de IA por tenant — período{' '}
            <span className="font-mono text-foreground">{period}</span>
          </p>
        </div>
      </header>

      {apiUnavailable && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-300">
          <strong>API AGRIVOR indisponível.</strong> Verifique se{' '}
          <code className="font-mono">SZDEVS_M2M_TOKEN</code> e{' '}
          <code className="font-mono">AGRIVOR_API_URL</code> estão configurados no VPS.
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <p className="text-xs text-ash">Gasto total no período</p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {tenantList.length > 0 ? fmtBrl.format(totalCents / 100) : '—'}
          </p>
          <p className="mt-1 text-[10px] text-ash/50">{tenantList.length} empresa(s) com dados</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-white/[0.02] p-5">
          <p className="text-xs text-ash">Em alerta (≥ 80% da cota)</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">{alertCount}</p>
          <p className="mt-1 text-[10px] text-ash/50">Próximas do limite máximo</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-white/[0.02] p-5">
          <p className="text-xs text-ash">Bloqueadas (cota esgotada)</p>
          <p className="mt-2 text-2xl font-bold text-red-400">{blockedCount}</p>
          <p className="mt-1 text-[10px] text-ash/50">IA suspensa até próximo período</p>
        </div>
      </div>

      {/* Bar chart */}
      {tenantList.length > 0 && (
        <section className="mb-8 rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Gasto vs. cota por empresa
          </h2>
          <p className="mb-4 text-[11px] text-ash/60">
            Verde = OK · Amarelo = alerta ≥ 80% · Vermelho = bloqueado
          </p>
          <AiSpendingChart tenants={tenantList} />
        </section>
      )}

      {/* Table */}
      <section className="rounded-xl border border-white/8 bg-white/[0.02]">
        <div className="border-b border-white/5 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Detalhamento por empresa</h2>
        </div>

        {tenantList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ash">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mb-3 h-10 w-10 opacity-30"
            >
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm">
              {apiUnavailable
                ? 'API AGRIVOR não configurada — configure SZDEVS_M2M_TOKEN.'
                : 'Nenhum consumo registrado neste período.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-[11px] font-medium uppercase tracking-wider text-ash">
                  <th className="px-5 py-3">Empresa</th>
                  <th className="px-5 py-3">Período</th>
                  <th className="px-5 py-3 text-right">Gasto</th>
                  <th className="px-5 py-3 text-right">Cota máx.</th>
                  <th className="px-5 py-3">Uso</th>
                  <th className="px-5 py-3">Última ativ.</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {tenantList
                  .slice()
                  .sort((a, b) => b.consumedCents - a.consumedCents)
                  .map((t) => (
                    <tr key={t.tenantId} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {t.name}
                        <span className="ml-1.5 font-mono text-[10px] text-ash/40">
                          {t.tenantId.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ash">{t.currentPeriod}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-foreground">
                        {fmtBrl.format(t.consumedCents / 100)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-ash">
                        {fmtBrl.format(t.hardQuotaCents / 100)}
                      </td>
                      <td className="px-5 py-3">
                        <QuotaBar percent={t.percentUsed} blocked={t.hardBlock} />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ash">
                        {t.lastActivity
                          ? new Date(t.lastActivity).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge row={t} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
