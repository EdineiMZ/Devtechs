'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Tab strip for /perfil/configuracoes/* — copper/acid aesthetic.
 */
const TABS: Array<{ href: string; label: string }> = [
  { href: '/perfil/configuracoes', label: 'Perfil' },
  { href: '/perfil/configuracoes/seguranca', label: 'Segurança' },
  { href: '/perfil/configuracoes/2fa', label: 'Autenticação 2FA' },
  { href: '/perfil/configuracoes/notificacoes', label: 'Notificações' },
];

export function SettingsTabs(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seções de configurações"
      className="mb-6 flex gap-1 border-b border-white/8"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === '/perfil/configuracoes'
            ? pathname === tab.href
            : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              'relative -mb-px px-4 py-2 font-body text-sm transition-colors ' +
              (active
                ? 'border-b-2 border-copper font-medium text-foreground'
                : 'border-b-2 border-transparent text-ash hover:text-foreground')
            }
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
