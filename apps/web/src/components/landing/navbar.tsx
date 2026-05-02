'use client';

import { motion, useScroll } from 'framer-motion';
import { Code2, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { label: 'Serviços',  href: '#servicos' },
  { label: 'Processo',  href: '#processo' },
  { label: 'Cases',     href: '#cases' },
  { label: 'FAQ',       href: '#faq' },
  { label: 'Contato',   href: '#cta' },
];

export function LandingNavbar() {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsub = scrollY.on('change', (y) => setScrolled(y > 60));
    return unsub;
  }, [scrollY]);

  return (
    <>
      <motion.nav
        className="fixed inset-x-0 top-0 z-50 h-16"
        animate={{
          backgroundColor: scrolled ? 'rgba(16,17,22,0.85)' : 'rgba(16,17,22,0)',
          backdropFilter:  scrolled ? 'blur(16px)' : 'blur(0px)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* top border glow when scrolled */}
        {scrolled && (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-copper/40 to-transparent" />
        )}

        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 group-hover:border-acid/60 transition-colors">
              <Code2 className="h-4 w-4 text-acid" />
            </div>
            <span className="font-display text-base font-semibold text-foreground tracking-tight">
              DevsTech
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="font-body text-sm text-ash hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden md:inline-flex items-center gap-2 rounded-md bg-copper px-5 py-2 text-sm font-semibold text-ink transition-all hover:bg-copper/85 copper-glow"
            >
              Iniciar projeto
            </Link>
            <button
              className="md:hidden text-ash hover:text-foreground transition-colors"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-ink/95 backdrop-blur-xl md:hidden flex flex-col gap-8 px-6 pt-24 pb-12">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="font-display text-2xl font-medium text-foreground"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            className="mt-auto inline-flex items-center justify-center rounded-md bg-copper px-6 py-3.5 text-base font-semibold text-ink"
          >
            Iniciar projeto
          </Link>
        </div>
      )}
    </>
  );
}
