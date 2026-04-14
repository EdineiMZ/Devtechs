import Link from 'next/link';

import { GitHubIcon, LinkedInIcon, TwitterIcon } from './icons';

const FOOTER_LINKS = {
  Produto: [
    { label: 'Serviços', href: '#servicos' },
    { label: 'Plataforma', href: '/login' },
    { label: 'Preços', href: '#contato' },
  ],
  Empresa: [
    { label: 'Sobre', href: '#sobre' },
    { label: 'Contato', href: '#contato' },
    { label: 'Carreiras', href: '/carreiras' },
  ],
  Legal: [
    { label: 'Privacidade', href: '/privacidade' },
    { label: 'Termos de uso', href: '/termos' },
    { label: 'LGPD', href: '/lgpd' },
  ],
};

const SOCIAL = [
  { label: 'LinkedIn', href: 'https://linkedin.com/company/devtechs', Icon: LinkedInIcon },
  { label: 'GitHub', href: 'https://github.com/devtechs', Icon: GitHubIcon },
  { label: 'Twitter', href: 'https://twitter.com/devtechs', Icon: TwitterIcon },
];

export function Footer(): JSX.Element {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-5">
          {/* Brand column — spans 2 on md+ */}
          <div className="md:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
              aria-label="DevTechs — voltar ao topo"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
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
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Tecnologia sob medida para empresas que querem crescer rápido
              sem abrir mão da qualidade.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border/80 bg-card/60 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} DevTechs. Todos os direitos reservados.</p>
          <p>
            Feito com <span className="text-primary">◆</span> no Brasil.
          </p>
        </div>
      </div>
    </footer>
  );
}
