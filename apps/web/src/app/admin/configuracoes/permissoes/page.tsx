import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { ADMIN_NAV_ITEMS } from '@/components/app/nav-config';
import { listPermissions, listRoles } from '@/lib/auth-admin-api';
import type { PermissionsByModuleResponse, RoleResponse } from '@/lib/auth-admin-api';

export const dynamic = 'force-dynamic';

export default async function PermissoesPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/configuracoes/permissoes');
  const user = session.user;
  if (!user.permissions.includes('dev:config:edit')) redirect('/perfil');

  const [permsRes, rolesRes] = await Promise.all([listPermissions(), listRoles()]);

  const permsByModule: PermissionsByModuleResponse = permsRes.ok
    ? (permsRes.data as PermissionsByModuleResponse)
    : {};
  const roles: RoleResponse[] = rolesRes.ok ? (rolesRes.data as RoleResponse[]) : [];

  // Build a map of permissionKey → roles that have it
  const permToRoles: Record<string, string[]> = {};
  for (const role of roles) {
    for (const perm of role.permissions) {
      if (!permToRoles[perm.key]) permToRoles[perm.key] = [];
      permToRoles[perm.key]!.push(role.name);
    }
  }

  const totalPerms = Object.values(permsByModule).flat().length;

  return (
    <AppShell
      pathname="/admin/configuracoes"
      navItems={ADMIN_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Configurações', href: '/admin/configuracoes' },
        { label: 'Permissões' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Matriz de permissões
        </h1>
        <p className="mt-1 text-sm text-ash">
          {totalPerms} permissões em {Object.keys(permsByModule).length} módulos
        </p>
      </header>

      {Object.keys(permsByModule).length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-10 text-center text-sm text-ash">
          Nenhuma permissão encontrada.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(permsByModule).map(([module, perms]) => (
            <section key={module} className="rounded-xl border border-white/8 bg-white/[0.02]">
              <div className="border-b border-white/8 px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">{module}</h2>
                <p className="text-xs text-ash">{perms.length} permissões</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-xs uppercase tracking-wider text-ash">
                      <th className="px-4 py-2 text-left font-medium">Chave</th>
                      <th className="px-4 py-2 text-left font-medium">Nome</th>
                      <th className="px-4 py-2 text-left font-medium">Papéis com acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {perms.map((p) => {
                      const assignedRoles = permToRoles[p.key] ?? [];
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-2.5">
                            <code className="font-mono text-xs text-violet-400">{p.key}</code>
                          </td>
                          <td className="px-4 py-2.5 text-foreground">{p.name}</td>
                          <td className="px-4 py-2.5">
                            {assignedRoles.length === 0 ? (
                              <span className="text-xs text-ash">Nenhum</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {assignedRoles.map((r) => (
                                  <span
                                    key={r}
                                    className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-400"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
