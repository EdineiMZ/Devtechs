'use client';

import { signOut } from 'next-auth/react';

/**
 * Small "sair e registrar outro email" link. Separated from the
 * resend button so each client island stays small and the
 * server-rendered shell can keep most of the page static.
 */
export function SignOutLink(): JSX.Element {
  return (
    <button
      type="button"
      className="font-medium text-primary underline-offset-4 hover:underline"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Sair e registrar novamente
    </button>
  );
}
