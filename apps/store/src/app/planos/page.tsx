import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { PlanGrid } from './plan-grid';
import { PlanComparison } from './plan-comparison';
import { fetchPlans, type Plan } from '@/lib/api';

export const metadata = { title: 'Planos - DevTechs' };
export const dynamic = 'force-dynamic';

async function getPlans(): Promise<Plan[]> {
  try {
    return await fetchPlans();
  } catch {
    return [];
  }
}

export default async function PlanosPage() {
  const plans = await getPlans();

  return (
    <div className="flex min-h-screen flex-col">
      <StoreHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 py-20 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoLTZWMzRoNnptLTI2IDB2NkgwVjM0aDEwem0yMC0yMHY2SDE0di02aDE2ek0zNiA0djZIMjZWNGgxMHpNNiAzNHY2SDBWMzRoNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-300">
              7 dias gratis em todos os planos
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Escolha o plano{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                ideal
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100/80">
              Infraestrutura completa para seu negocio. Cancele quando quiser.
            </p>
          </div>
        </section>

        {/* Plan Cards */}
        <section className="-mt-12 px-4 pb-16">
          <PlanGrid plans={plans} />
        </section>

        {/* Comparison Table */}
        <section className="border-t border-border bg-muted/30 px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
              Compare os planos
            </h2>
            <PlanComparison plans={plans} />
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16 text-center text-white">
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-3xl font-bold">Pronto para comecar?</h2>
            <p className="mt-3 text-blue-100">
              Comece gratis por 7 dias. Sem compromisso.
            </p>
          </div>
        </section>
      </main>

      <StoreFooter />
    </div>
  );
}
