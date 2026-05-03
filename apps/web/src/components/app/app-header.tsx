import { Code2 } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, Button } from '@szdevs/ui';

import { auth, signOut } from '@/auth';

/**
 * Authenticated app header â€” copper/acid aesthetic.
 * Server component so the session read happens on the Node side.
 */
export async function AppHeader(): Promise<JSX.Element> {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/perfil"
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 group-hover:border-acid/60 transition-colors">
            <Code2 className="h-4 w-4 text-acid" />
          </div>
          <span className="font-display text-base font-semibold text-foreground tracking-tight">
            SZDevs
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="hidden items-center gap-3 md:flex">
                <Avatar size="sm" className="ring-2 ring-copper/25">
                  <AvatarFallback
                    className="font-display font-semibold text-xs text-ink"
                    style={{ background: 'linear-gradient(135deg, hsl(28 72% 58%), hsl(16 68% 40%))' }}
                  >
                    {user.name?.slice(0, 2).toUpperCase() ?? 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="font-body text-sm font-medium text-foreground">
                    {user.name ?? user.email}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-copper/70">
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
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-ash hover:text-foreground hover:border-white/20 font-body text-xs"
                >
                  Sair
                </Button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-copper px-5 py-2 text-sm font-semibold text-ink transition-all hover:bg-copper/85 copper-glow"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
