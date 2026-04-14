'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Client wrapper around NextAuth's `SessionProvider`.
 *
 * Imported once from `app/layout.tsx`. We keep it in its own file
 * (rather than adding `'use client'` to the layout itself) so the
 * rest of the root layout — metadata, fonts, theme class — stays
 * server-rendered.
 */
export function Providers({ children }: { children: ReactNode }): JSX.Element {
  return <SessionProvider>{children}</SessionProvider>;
}
