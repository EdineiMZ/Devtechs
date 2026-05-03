import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listUsers, listRoles } from '@/lib/auth-admin-api';
import type { PaginatedUsers, UserAdminItem, RoleResponse } from '@/lib/auth-admin-api';

import { UserActions } from './_components/user-actions';
import { UserRolesManager } from './_components/user-roles-manager';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  role?: string;
  page?: string;
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes/usuarios');
  const user = session.user;
  if (!session.accessToken) redirect('/login?callbackUrl=/admin/configuracoes');
  if (!user.permissions.includes('dev:config:edit')) redirect('/perfil');

  const page = Number(searchParams.page ?? 1);
  const [res, rolesRes] = await Promise.all([
    listUsers({
      q: searchParams.q,
      role: searchParams.role,
      page,
      pageSize: 20,
    }),
    listRoles(),
  ]);

  const data = res.ok ? (res.data as PaginatedUsers) : null;
  const users: UserAdminItem[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const allRoles: RoleResponse[] = rolesRes.ok ? (rolesRes.data as RoleResponse[]) : [];

  const dateFmt = new Intl.DateTimeFormat('pt-BR');

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações', href: '/admin/configuracoes' },
        { label: 'Usuários' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Usuários
        </h1>
        <p className="mt-1 text-sm text-ash">{total} usuários cadastrados</p>
      </header>

      {/* Filters */}
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Buscar por nome ou e-mail"
          className="w-64 rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <input
          name="role"
          defaultValue={searchParams.role ?? ''}
          placeholder="Papel (ex: admin)"
          className="rounded-md border border-white/8 bg-background px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-600/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/30"
        >
          Buscar
        </button>
      </form>

      <div className="rounded-xl border border-white/8 bg-white/[0.02]">
        {users.length === 0 ? (
          <p className="p-10 text-center text-sm text-ash">
            Nenhum usuário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                  <th className="px-4 py-3 text-left font-medium">Usuário</th>
                  <th className="px-4 py-3 text-left font-medium">Papéis</th>
                  <th className="px-4 py-3 text-left font-medium">Cadastro</th>
                  <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-white/[0.03] ${u.banned || u.status === 'INACTIVE' ? 'opacity-70' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{u.name ?? '(sem nome)'}</p>
                      <p className="text-xs text-ash">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <UserRolesManager
                        user={u}
                        allRoles={allRoles}
                        accessToken={session.accessToken!}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">
                      {dateFmt.format(new Date(u.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-xs text-ash">
                      {u.lastLoginAt ? dateFmt.format(new Date(u.lastLoginAt)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.banned ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-400">
                            Banido
                          </span>
                        ) : u.status === 'INACTIVE' ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">
                            Suspenso
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                            Ativo
                          </span>
                        )}
                        {!u.emailVerified && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-400">
                            E-mail pendente
                          </span>
                        )}
                        {u.twoFactorEnabled && (
                          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-400">
                            2FA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions user={u} accessToken={session.accessToken!} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
            <p className="text-xs text-ash">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/admin/configuracoes/usuarios?page=${page - 1}${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                  className="rounded-md border border-white/8 px-3 py-1 text-xs hover:bg-white/[0.04]"
                >
                  Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/admin/configuracoes/usuarios?page=${page + 1}${searchParams.q ? `&q=${encodeURIComponent(searchParams.q)}` : ''}`}
                  className="rounded-md border border-white/8 px-3 py-1 text-xs hover:bg-white/[0.04]"
                >
                  Próxima
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
