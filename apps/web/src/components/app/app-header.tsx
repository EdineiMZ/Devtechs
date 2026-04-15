import Link from 'next/link';

import { Avatar, AvatarFallback, Button } from '@devtechs/ui';

import { auth, signOut } from '@/auth';

/**
 * Authenticated app header — shows the user's avatar, name and role,
 * plus a signOut button that POSTs to the NextAuth signOut endpoint
 * via a server action. Server component so the session read happens
 * on the Node side without a client round-trip.
 */
export async function AppHeader(): Promise<JSX.Element> {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/perfil"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </span>
          <span>
            Dev<span className="text-primary">Techs</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden items-center gap-3 md:flex">
                <Avatar size="sm">
                  <AvatarFallback>
                    {user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="text-sm font-medium text-foreground">
                    {user.name ?? user.email}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.mainRole ?? 'member'}
                  </div>
                </div>
              </div>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <Button type="submit" size="sm" variant="outline">
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
