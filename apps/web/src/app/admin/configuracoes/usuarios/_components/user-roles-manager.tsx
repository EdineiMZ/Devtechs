'use client';

import { useState } from 'react';

import { assignRoleToUser, unassignRoleFromUser } from '@/lib/auth-admin-api';
import type { RoleResponse, UserAdminItem } from '@/lib/auth-admin-api';

interface Props {
  user: UserAdminItem;
  allRoles: RoleResponse[];
  accessToken: string;
}

export function UserRolesManager({ user, allRoles, accessToken }: Props): JSX.Element {
  const [currentRoleNames, setCurrentRoleNames] = useState<string[]>(user.roles);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roleByName = new Map(allRoles.map((r) => [r.name, r]));
  const unassignedRoles = allRoles.filter((r) => !currentRoleNames.includes(r.name));

  async function handleAssign(role: RoleResponse): Promise<void> {
    setLoading(`assign:${role.id}`);
    setError(null);
    setAdding(false);
    const res = await assignRoleToUser(role.id, user.id, accessToken);
    setLoading(null);
    if (!res.ok) {
      const err = res.data as { message?: string | string[] };
      const msg = Array.isArray(err.message) ? err.message[0] : err.message;
      setError(msg ?? 'Não foi possível vincular o papel.');
      return;
    }
    setCurrentRoleNames((prev) => [...prev, role.name]);
  }

  async function handleUnassign(roleName: string): Promise<void> {
    const role = roleByName.get(roleName);
    if (!role) return;
    setLoading(`unassign:${role.id}`);
    setError(null);
    const res = await unassignRoleFromUser(role.id, user.id, accessToken);
    setLoading(null);
    if (!res.ok) {
      const err = res.data as { message?: string | string[] };
      const msg = Array.isArray(err.message) ? err.message[0] : err.message;
      setError(msg ?? 'Não foi possível desvincular o papel.');
      return;
    }
    setCurrentRoleNames((prev) => prev.filter((n) => n !== roleName));
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {currentRoleNames.map((name) => {
        const role = roleByName.get(name);
        const isUnassigning = loading === `unassign:${role?.id}`;
        return (
          <span
            key={name}
            className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400"
          >
            {name}
            {role ? (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void handleUnassign(name)}
                className="ml-0.5 leading-none opacity-50 hover:opacity-100 disabled:opacity-20"
                title={`Remover papel ${name}`}
              >
                {isUnassigning ? '…' : '×'}
              </button>
            ) : null}
          </span>
        );
      })}

      {unassignedRoles.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => setAdding((v) => !v)}
            className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-ash hover:bg-white/15 hover:text-foreground disabled:opacity-30"
            title="Adicionar papel"
          >
            +
          </button>

          {adding ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAdding(false)} />
              <div className="absolute left-0 top-6 z-20 min-w-[140px] rounded-lg border border-white/8 bg-[#0d1117] p-1 shadow-xl">
                {unassignedRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    disabled={loading !== null}
                    onClick={() => void handleAssign(role)}
                    className="w-full rounded-md px-3 py-1.5 text-left text-xs text-foreground hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    {loading === `assign:${role.id}` ? 'Vinculando…' : role.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <span className="w-full text-[10px] text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
