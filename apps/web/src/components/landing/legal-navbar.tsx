import { Code2 } from 'lucide-react';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Serviços', href: '/#servicos' },
  { label: 'Processo', href: '/#processo' },
  { label: 'Cases',    href: '/#cases'    },
  { label: 'FAQ',      href: '/#faq'      },
  { label: 'Contato',  href: '/#cta'      },
];

export function LegalNavbar() {
  return (
    <>
      {/* always-solid backdrop — legal pages are content-heavy and immediately scrolled */}
      <header className="fixed inset-x-0 top-0 z-50 h-16">
        {/* border glow (always visible, same as LandingNavbar scrolled state) */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-copper/40 to-transparent" />

        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(16,17,22,0.92)', backdropFilter: 'blur(16px)' }}
        />

        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 transition-colors group-hover:border-acid/60">
              <Code2 className="h-4 w-4 text-acid" />
            </div>
            <span className="font-display text-base font-semibold tracking-tight text-foreground">
              SZDevs
            </span>
          </Link>

          {/* Desktop nav — same items as LandingNavbar, pointing to / anchors */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-body text-sm text-ash transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <Link
            href="/login"
            className="copper-glow hidden md:inline-flex items-center gap-2 rounded-md bg-copper px-5 py-2 text-sm font-semibold text-ink transition-all hover:bg-copper/85"
          >
            Iniciar projeto
          </Link>

          {/* Mobile — simplified back link */}
          <Link
            href="/"
            className="font-body text-sm text-ash transition-colors hover:text-foreground md:hidden"
          >
            ← Início
          </Link>
        </div>
      </header>
    </>
  );
}
