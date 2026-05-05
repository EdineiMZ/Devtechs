'use client';

import { Code2 } from 'lucide-react';
import Link from 'next/link';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const FOOTER_LINKS = [
  { label: 'Política de Privacidade', href: '/privacidade' },
  { label: 'Termos de Uso',           href: '/termos' },
  { label: 'GitHub',                  href: 'https://github.com/EBSZDEVS' },
  { label: 'LinkedIn',                href: 'https://linkedin.com/company/SZDevs' },
];

export function CtaFinal(): JSX.Element {
  return (
    <>
      {/* ── CTA Section ── */}
      <section id="cta" className="py-24 lg:py-32 bg-ink border-t border-white/5 relative overflow-hidden">
        {/* Background glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 55% 45% at 50% 60%, hsl(28 72% 58% / 0.08) 0%, transparent 70%)',
          }}
        />
        {/* Grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(28 72% 58% / 0.06) 1px, transparent 1px), linear-gradient(to bottom, hsl(28 72% 58% / 0.06) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)',
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 lg:px-8 text-center flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <TerminalBadge variant="copper">{'// próximo passo'}</TerminalBadge>
            <BlurText
              as="h2"
              text="Pronto para construir algo real?"
              className="font-display font-semibold text-foreground"
              style={{ fontSize: 'clamp(32px, 5vw, 64px)' } as React.CSSProperties}
            />
            <p className="text-ash font-body text-base leading-relaxed max-w-lg">
              Uma conversa. Um escopo. Um produto que funciona de verdade.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-copper px-8 py-3.5 text-sm font-semibold text-ink transition-all hover:bg-copper/85 copper-glow"
            >
              Iniciar projeto
            </Link>
            <a
              href="https://github.com/EBSZDEVS"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-acid/30 text-acid px-8 py-3.5 text-sm font-mono tracking-wider hover:bg-acid/5 hover:border-acid/60 transition-all"
            >
              Ver nosso GitHub
            </a>
          </div>

          <p className="font-mono text-xs text-ash">{'// resposta em até 24h úteis'}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-ink border-t border-white/8">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Brand */}
            <div className="flex flex-col gap-2">
              <Link href="/" className="flex items-center gap-2.5 group">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-acid/30 bg-acid/8 group-hover:border-acid/60 transition-colors">
                  <Code2 className="h-4 w-4 text-acid" />
                </div>
                <span className="font-display text-base font-semibold text-foreground tracking-tight">
                  SZDevs
                </span>
              </Link>
              <p className="font-body text-xs text-ash max-w-xs leading-relaxed">
                Código que escala. Produto que converte.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 sm:flex sm:flex-row sm:gap-8">
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-body text-sm text-ash hover:text-foreground transition-colors"
                  {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-mono text-xs text-ash">
              © 2026 SZDevs. Todos os direitos reservados.
            </p>
            <p className="font-mono text-xs text-ash">
              built with precision in Brazil 🇧🇷
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
