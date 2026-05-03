import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { SubscriptionDashboard } from './subscription-dashboard';

export const metadata = { title: 'Minha Assinatura - SZDevs' };
export const dynamic = 'force-dynamic';

export default async function AssinaturaPage() {
  const session = await auth();
  if (!session) redirect('/login?callbackUrl=/conta/assinatura');

  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />
      <main className="flex-1 bg-gradient-to-b from-slate-50 to-white py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Minha Assinatura</h1>
          <p className="mb-8 text-muted-foreground">
            Gerencie seu plano, pagamentos e assinatura
          </p>
          <SubscriptionDashboard />
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
