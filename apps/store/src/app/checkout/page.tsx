import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { fetchPlans, type Plan } from '@/lib/api';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { CheckoutForm } from './checkout-form';

export const metadata = { title: 'Checkout - SZDevs' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login?callbackUrl=/checkout');

  const params = await searchParams;
  const planId = params.planId;

  const plans = await fetchPlans().catch(() => [] as Plan[]);
  const selectedPlan = planId ? plans.find((p) => p.id === planId) : plans[0];

  if (!selectedPlan) {
    redirect('/planos');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />
      <main className="flex-1 bg-gradient-to-b from-slate-50 to-white py-12">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Finalizar assinatura</h1>
          <p className="mb-8 text-muted-foreground">
            Complete seu cadastro e comece a usar a plataforma
          </p>
          <CheckoutForm plan={selectedPlan} plans={plans} />
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
