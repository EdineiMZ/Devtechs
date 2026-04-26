'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export function StoreHeader() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
            <span className="text-sm font-bold text-white">D</span>
          </div>
          <span className="text-lg font-bold text-foreground">DevTechs</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/planos"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Planos
          </Link>
          {session ? (
            <Link
              href="/conta/assinatura"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Minha Assinatura
            </Link>
          ) : null}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
