import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { Badge, Card, CardContent, CardHeader, CardTitle, cn } from '@devtechs/ui';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { type SecurityReport, getSecurityReport } from '@/lib/audit-api';

export const dynamic = 'force-dynamic';

export default async function SecurityReportPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/auditoria/seguranca');
  const user = session.user;
  if (!user.permissions.includes('dev:config:edit')) redirect('/admin/auditoria');

  const res = await getSecurityReport();
  const report: SecurityReport =
    res.ok && 'failedLoginIps' in (res.data as object)
      ? (res.data as SecurityReport)
      : { failedLoginIps: [], usersWithManyForbidden: [], oldSessions: [] };
  const error =
    !res.ok ? (res.data as { message?: string })?.message ?? 'Falha ao carregar relatório' : null;

  return (
    <AppShell
      pathname="/admin/auditoria/seguranca"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Auditoria', href: '/admin/auditoria' },
        { label: 'Segurança' },
      ]}
    >
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Relatório de segurança</h1>
          <p className="text-sm text-ash">
            Sinais agregados das últimas 24h + sessões antigas (&gt;30 dias).
          </p>
        </header>

        {error ? (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="py-3 text-sm text-red-200">{error}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="text-sm font-medium">
              IPs com tentativas de login falhas (últimas 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {report.failedLoginIps.length === 0 ? (
              <p className="text-sm text-ash">
                Nenhum IP atingiu o limiar de 5 falhas nas últimas 24h.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-ash">
                  <tr>
                    <th className="px-3 py-2 font-medium">IP</th>
                    <th className="px-3 py-2 font-medium">Falhas</th>
                    <th className="px-3 py-2 font-medium">Última tentativa</th>
                  </tr>
                </thead>
                <tbody>
                  {report.failedLoginIps.map((row) => (
                    <tr key={row.ipAddress} className="border-b border-white/8">
                      <td className="px-3 py-2">
                        <code className="text-xs">{row.ipAddress}</code>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={cn(
                            'border font-mono',
                            row.failures >= 20
                              ? 'border-red-500/40 bg-red-500/15 text-red-200'
                              : 'border-amber-500/40 bg-amber-500/15 text-amber-200',
                          )}
                        >
                          {row.failures}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-ash">
                        {new Date(row.lastAttemptAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="text-sm font-medium">
              Usuários com muitos 403 (últimas 24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {report.usersWithManyForbidden.length === 0 ? (
              <p className="text-sm text-ash">
                Nenhum usuário atingiu o limiar de 10 erros 403 nas últimas 24h.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {report.usersWithManyForbidden.map((u) => (
                  <li
                    key={u.userId}
                    className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.02] p-3"
                  >
                    <a
                      href={`/admin/usuarios/${u.userId}/atividade`}
                      className="text-sky-300 hover:underline"
                    >
                      <code className="text-xs">{u.userId}</code>
                    </a>
                    <Badge className="border border-amber-500/40 bg-amber-500/15 font-mono text-amber-200">
                      {u.forbidden} 403s
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-white/8">
            <CardTitle className="text-sm font-medium">
              Sessões abertas há mais de 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {report.oldSessions.length === 0 ? (
              <p className="text-sm text-ash">
                Nenhuma sessão antiga ativa.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8 text-[11px] uppercase tracking-wider text-ash">
                  <tr>
                    <th className="px-3 py-2 font-medium">Usuário</th>
                    <th className="px-3 py-2 font-medium">IP</th>
                    <th className="px-3 py-2 font-medium">Aberta em</th>
                  </tr>
                </thead>
                <tbody>
                  {report.oldSessions.map((s) => (
                    <tr key={s.sessionId} className="border-b border-white/8">
                      <td className="px-3 py-2">
                        <a
                          href={`/admin/usuarios/${s.userId}/atividade`}
                          className="text-sky-300 hover:underline"
                        >
                          {s.userEmail ?? s.userId.slice(0, 8) + '…'}
                        </a>
                      </td>
                      <td className="px-3 py-2">
                        <code className="text-xs">{s.ipAddress ?? '—'}</code>
                      </td>
                      <td className="px-3 py-2 text-ash">
                        {new Date(s.createdAt).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
