import { Code2 } from 'lucide-react';
import Link from 'next/link';

import { auth } from '@/auth';
import { getRedirectForRole } from '@/lib/role-redirect';

/**
 * Auth-aware top navigation bar for pages that need session context
 * (e.g. pages that can't use the fully-static LandingNavbar).
 * Shows "Ir para a plataforma" when authenticated, "Entrar" otherwise.
 */
const NAV_LINKS = [
  { href: '#servicos',    label: 'Serviços' },
  { href: '#processo',    label: 'Processo' },
  { href: '#cases',       label: 'Cases' },
  { href: '#faq',         label: 'FAQ' },
  { href: '#cta',         label: 'Contato' },
];

export async function Header(): Promise<JSX.Element> {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);
  const ctaHref = isAuthenticated
    ? getRedirectForRole(session?.user?.mainRole)
    : '/login';
  const ctaLabel = isAuthenticated ? 'Ir para a plataforma' : 'Iniciar projeto';

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/5 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="SZDevs — página inicial"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 group-hover:border-acid/60 transition-colors">
            <Code2 className="h-4 w-4 text-acid" />
          </div>
          <span className="font-display text-base font-semibold text-foreground tracking-tight">
            SZDevs
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Navegação principal" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-body text-sm text-ash hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-md bg-copper px-5 py-2 text-sm font-semibold text-ink transition-all hover:bg-copper/85 copper-glow"
        >
          {ctaLabel}
        </Link>
      </div>
    </header>
  );
}
