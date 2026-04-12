import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export interface AuthLayoutProps {
  /** Logo or brand rendered above the form. */
  brand?: ReactNode;
  /** Form title (e.g. "Entrar na sua conta"). */
  title: ReactNode;
  /** Optional subtitle / helper text. */
  subtitle?: ReactNode;
  /** The form itself. */
  children: ReactNode;
  /** Bottom helper (e.g. "Não tem uma conta? Registre-se"). */
  footer?: ReactNode;
  /** Decorative side content (marketing, illustration). */
  side?: ReactNode;
  className?: string;
}

/**
 * Centered card layout used by /login, /register and /forgot-password.
 * On large screens it splits into a form column + a decorative `side` column.
 */
export function AuthLayout({
  brand,
  title,
  subtitle,
  children,
  footer,
  side,
  className,
}: AuthLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen w-full bg-background text-foreground',
        className,
      )}
    >
      {/* Form column */}
      <div className="flex w-full flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-8">
        <div className="w-full max-w-md space-y-6">
          {brand ? <div className="flex justify-center">{brand}</div> : null}

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm dark:bg-card">
            {children}
          </div>

          {footer ? (
            <div className="text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </div>
      </div>

      {/* Decorative side */}
      {side ? (
        <aside
          aria-hidden="true"
          className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-muted lg:flex dark:bg-muted"
        >
          {side}
        </aside>
      ) : null}
    </div>
  );
}
