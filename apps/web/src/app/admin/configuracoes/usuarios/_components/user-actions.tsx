'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  suspendUser,
  activateUser,
  disable2FA,
  revokeSessions,
  banUser,
  unbanUser,
} from '@/lib/auth-admin-api';
import type { UserAdminItem } from '@/lib/auth-admin-api';

interface Props {
  user: UserAdminItem;
  accessToken: string;
}

export function UserActions({ user, accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function run(
    action: string,
    fn: () => Promise<{ ok: boolean; data: unknown }>,
    confirm_msg?: string,
  ) {
    if (confirm_msg && !confirm(confirm_msg)) return;
    setLoading(action);
    try {
      const res = await fn();
      if (!res.ok) {
        const err = res.data as { message?: string };
        alert(err.message ?? 'Erro ao executar ação.');
      } else {
        router.refresh();
      }
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  const isActive = user.status === 'ACTIVE' && !user.banned;
  const isSuspended = user.status === 'INACTIVE';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-white/8 px-2 py-1 text-xs text-ash hover:border-sky-500/40 hover:text-sky-300"
      >
        Ações ▾
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-white/8 bg-white/[0.02] p-1 shadow-lg">
            {isActive && (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  void run(
                    'suspend',
                    () => suspendUser(user.id, accessToken),
                    `Suspender a conta de ${user.name ?? user.email}? O usuário não poderá acessar o sistema.`,
                  )
                }
                className="w-full rounded-md px-3 py-2 text-left text-xs text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {loading === 'suspend' ? 'Suspendendo…' : 'Suspender conta'}
              </button>
            )}

            {isSuspended && (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  void run('activate', () => activateUser(user.id, accessToken))
                }
                className="w-full rounded-md px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {loading === 'activate' ? 'Ativando…' : 'Reativar conta'}
              </button>
            )}

            {!user.banned ? (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  void run(
                    'ban',
                    () => banUser(user.id, accessToken),
                    `Banir ${user.name ?? user.email}? Esta ação impedirá o login permanentemente até ser revertida.`,
                  )
                }
                className="w-full rounded-md px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {loading === 'ban' ? 'Banindo…' : 'Banir usuário'}
              </button>
            ) : (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void run('unban', () => unbanUser(user.id, accessToken))}
                className="w-full rounded-md px-3 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {loading === 'unban' ? 'Desbanindo…' : 'Remover banimento'}
              </button>
            )}

            {user.twoFactorEnabled && (
              <button
                type="button"
                disabled={loading !== null}
                onClick={() =>
                  void run(
                    'disable2fa',
                    () => disable2FA(user.id, accessToken),
                    `Desativar 2FA de ${user.name ?? user.email}? O usuário terá que configurar novamente.`,
                  )
                }
                className="w-full rounded-md px-3 py-2 text-left text-xs text-sky-400 hover:bg-sky-500/10 disabled:opacity-50"
              >
                {loading === 'disable2fa' ? 'Desativando 2FA…' : 'Desativar 2FA'}
              </button>
            )}

            <button
              type="button"
              disabled={loading !== null}
              onClick={() =>
                void run(
                  'revoke',
                  () => revokeSessions(user.id, accessToken),
                  `Revogar todas as sessões de ${user.name ?? user.email}? O usuário será desconectado.`,
                )
              }
              className="w-full rounded-md px-3 py-2 text-left text-xs text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
            >
              {loading === 'revoke' ? 'Revogando…' : 'Revogar sessões'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
