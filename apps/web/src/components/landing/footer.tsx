import { Code2 } from 'lucide-react';
import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Política de Privacidade', href: '/privacidade' },
  { label: 'Termos de Uso',           href: '/termos' },
  { label: 'GitHub',                  href: 'https://github.com/EBSZDEVS' },
  { label: 'LinkedIn',                href: 'https://linkedin.com/company/SZDevs' },
];

export function Footer(): JSX.Element {
  return (
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
            © {new Date().getFullYear()} SZDevs. Todos os direitos reservados.
          </p>
          <p className="font-mono text-xs text-ash">
            built with precision in Brazil 🇧🇷
          </p>
        </div>
      </div>
    </footer>
  );
}
