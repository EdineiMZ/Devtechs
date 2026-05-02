import { Code2 } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared shell for the /login, /register, and /verificar-email pages.
 * Follows the same copper/acid terminal aesthetic as the landing page.
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
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 sm:py-20 bg-ink">
      {/* Background layers */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(160 100% 48% / 0.07) 1px, transparent 1px), linear-gradient(to bottom, hsl(160 100% 48% / 0.07) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
          }}
        />
        {/* Copper glow */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 65%, hsl(28 72% 58% / 0.08) 0%, transparent 70%)',
          }}
        />
        {/* Acid glow top */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 40% 30% at 50% 15%, hsl(160 100% 48% / 0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="animate-fade-up w-full max-w-md">
        {/* Brand mark */}
        <Link
          href="/"
          className="mx-auto mb-8 flex w-fit items-center gap-2.5 group"
          aria-label="DevsTech — voltar à página inicial"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 group-hover:border-acid/60 transition-colors">
            <Code2 className="h-4 w-4 text-acid" />
          </div>
          <span className="font-display text-base font-semibold text-foreground tracking-tight">
            DevsTech
          </span>
        </Link>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-ash font-body leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>

        {/* Card */}
        <div className="liquid-glass rounded-2xl p-8">
          {children}
        </div>

        {/* Footer slot */}
        {footer ? (
          <p className="mt-6 text-center text-sm text-ash font-body">
            {footer}
          </p>
        ) : null}
      </div>
    </main>
  );
}
