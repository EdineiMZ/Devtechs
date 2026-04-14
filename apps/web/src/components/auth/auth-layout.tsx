import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card } from '@devtechs/ui';

/**
 * Shared shell for the /login, /register, and /verificar-email
 * pages. Provides a centered card with the brand mark above it and
 * the same grid/glow backdrop used on the landing hero so the auth
 * screens feel like part of the same surface.
 *
 * The sibling auth pages compose their own content inside `children`
 * while this component owns:
 *   - the outer section + backdrop
 *   - the brand link (takes the user back to "/")
 *   - the card chrome
 *   - the bottom helper slot for cross-links (sign-up ↔ sign-in, etc.)
 */
export interface AuthLayoutProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthLayout({
  title,
  description,
  footer,
  children,
}: AuthLayoutProps): JSX.Element {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 sm:py-20">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-hero-glow" />
      </div>

      <div className="animate-fade-up w-full max-w-md">
        {/* Brand mark */}
        <Link
          href="/"
          className="mx-auto mb-8 flex w-fit items-center gap-2 text-lg font-semibold tracking-tight"
          aria-label="DevTechs — voltar à página inicial"
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

        <div className="mb-6 text-center">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-pretty text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <Card
          className="border-border/80 bg-card/80 backdrop-blur-sm"
          padding="lg"
        >
          {children}
        </Card>

        {footer ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </div>
    </main>
  );
}
