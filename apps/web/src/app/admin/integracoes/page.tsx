import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { fmtDateTime } from '@/lib/fmt-date';
import { listApiKeys, type ApiKey, type ApiKeyStatus } from '@/lib/api-keys-api';

import { CreateKeyDialog } from './_components/create-key-dialog';

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

function StatusBadge({ status }: { status: ApiKeyStatus }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function IntegracoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/integracoes');
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/integracoes');

  const { user } = session;
  if (!user.permissions.includes('integrations:manage')) redirect('/perfil');

  const keysRes = await listApiKeys(session.accessToken).catch(() => ({ ok: false, data: [] }));

  const keys: ApiKey[] =
    keysRes.ok && Array.isArray(keysRes.data) ? (keysRes.data as ApiKey[]) : [];

  const totalKeys = keys.length;
  const activeKeys = keys.filter((k) => k.status === 'ACTIVE').length;
  const revokedKeys = keys.filter((k) => k.status === 'REVOKED').length;
  const totalRequests = keys.reduce((sum, k) => sum + (k.totalRequests ?? 0), 0);

  const serviceError = !keysRes.ok
    ? 'api-service pode estar indisponível. Alguns dados podem não aparecer.'
    : null;

  return (
    <AppShell
      pathname="/admin/integracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Integrações' }]}
    >
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Integrações & API</h1>
          <p className="mt-1 text-sm text-ash">
            Gerencie chaves de API para integrações externas com a plataforma.
          </p>
        </div>
        <CreateKeyDialog />
      </div>

      {serviceError ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
          {serviceError}
        </div>
      ) : null}

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de chaves" value={totalKeys} />
        <StatCard label="Chaves ativas" value={activeKeys} accent="text-emerald-400" />
        <StatCard label="Revogadas" value={revokedKeys} accent="text-destructive" />
        <StatCard
          label="Total de requisições"
          value={totalRequests.toLocaleString('pt-BR')}
          accent="text-sky-400"
        />
      </div>

      {/* Table */}
      {keys.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-ash">Nenhuma chave de API cadastrada.</p>
          <p className="mt-1 text-xs text-ash/60">
            Crie uma nova integração para começar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-ash">Nome</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">Prefixo</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">Permissões</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">IP Binding</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">Último uso</th>
                  <th className="px-4 py-3 text-xs font-medium text-ash">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-foreground">{key.name}</td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs text-ash">{key.keyPrefix}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.slice(0, 3).map((p) => (
                          <span
                            key={p}
                            className="bg-white/10 text-ash px-1.5 py-0.5 rounded text-[10px]"
                          >
                            {p}
                          </span>
                        ))}
                        {key.permissions.length > 3 && (
                          <span className="bg-white/10 text-ash px-1.5 py-0.5 rounded text-[10px]">
                            +{key.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">{key.ipBinding}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={key.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">
                      {fmtDateTime(key.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/integracoes/${key.id}`}
                        className="text-xs text-sky-400 hover:text-sky-300"
                      >
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
