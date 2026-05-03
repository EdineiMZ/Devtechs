import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AppShell } from '@/components/app/app-shell';
import { CLIENT_NAV_ITEMS } from '@/components/app/nav-config';

import { NewTicketForm } from './new-ticket-form';

export const dynamic = 'force-dynamic';

/**
 * Server wrapper that gates the form on a valid session and renders
 * the AppShell. The form itself is a client component because it
 * uses react-hook-form + Zod.
 */
export default async function NewTicketPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/perfil/tickets/novo');
  }
  const user = session.user;

  return (
    <AppShell
      pathname="/perfil/tickets/novo"
      navItems={CLIENT_NAV_ITEMS}
      permissions={user.permissions}
      breadcrumbs={[
        { label: 'Minha conta', href: '/perfil' },
        { label: 'Chamados', href: '/perfil/tickets' },
        { label: 'Novo' },
      ]}
    >
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-copper">
          Suporte
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          Abrir novo chamado
        </h1>
        <p className="mt-1 text-sm text-ash">
          Descreva o problema com o máximo de detalhes — quanto melhor o
          contexto, mais rápida a resposta.{' '}
          <Link
            href="/perfil/tickets"
            className="text-copper underline-offset-4 hover:underline"
          >
            Voltar para meus chamados
          </Link>
        </p>
      </header>

      <NewTicketForm accessToken={session.accessToken} />
    </AppShell>
  );
}
