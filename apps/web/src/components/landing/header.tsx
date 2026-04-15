import Link from 'next/link';

import { Button } from '@devtechs/ui';

import { auth } from '@/auth';
import { getRedirectForRole } from '@/lib/role-redirect';

import { ArrowRightIcon } from './icons';

/**
 * Top-of-page navigation.
 *
 * Server component so it can read the NextAuth session directly
 * without a client round-trip. When a user is logged in the CTA
 * switches from "Entrar" to "Ir para a plataforma" and points at
 * the role-aware dashboard (admin → /admin, member → /perfil, etc.).
 *
 * - Sticky with a translucent backdrop blur so content scrolls under it.
 * - Uses plain anchor links (`#services`, `#sobre`, `#contato`) so
 *   smooth-scroll is handled entirely by the `scroll-behavior: smooth`
 *   rule on <html> — zero JS for scroll behavior.
 * - The mobile breakpoint drops the inline nav and keeps only the
 *   brand + CTA, which is the minimum viable mobile UX for a
 *   single-page landing.
 */
const NAV_LINKS = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#contato', label: 'Contato' },
];

export async function Header(): Promise<JSX.Element> {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);
  const ctaHref = isAuthenticated
    ? getRedirectForRole(session?.user?.mainRole)
    : '/login';
  const ctaLabel = isAuthenticated ? 'Ir para a plataforma' : 'Entrar';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-semibold tracking-tight"
          aria-label="DevTechs — página inicial"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-transform group-hover:scale-105"
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

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Button asChild size="sm" className="gap-1.5">
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
