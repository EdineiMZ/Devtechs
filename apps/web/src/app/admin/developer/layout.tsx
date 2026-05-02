import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { verifyDevAccessToken } from './auth/token';
import { DeveloperAuthGate } from './auth/auth-gate';

/**
 * Layout for /admin/developer/* — enforces a secondary password
 * confirmation cookie on top of the normal session check.
 *
 * When the cookie is missing or expired the layout renders the
 * DeveloperAuthGate client component (full-page lock screen) in
 * place of children — no separate route needed, so there's no
 * redirect loop risk.
 */
export default async function DeveloperLayout({
  children,
}: {
  children: ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin/developer');
  if (!session.user.permissions.includes('dev:logs:view')) redirect('/perfil');

  const token = cookies().get('dev_access')?.value ?? '';
  const valid = token ? verifyDevAccessToken(token) : false;

  if (!valid) {
    // Render the lock screen instead of the requested page.
    return <DeveloperAuthGate />;
  }

  return <>{children}</>;
}
