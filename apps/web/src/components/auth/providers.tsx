'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

import { CookieBanner } from '@/components/cookie-banner';

/**
 * Client wrapper around NextAuth's `SessionProvider`.
 *
 * Also mounts the cookie consent banner (LGPD art. 7º, I) globally
 * so it appears on every page before a preference is stored.
 */
export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <SessionProvider>
      {children}
      <CookieBanner />
    </SessionProvider>
  );
}
