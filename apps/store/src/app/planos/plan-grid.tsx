'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { Plan } from '@/lib/api';
import { formatPrice } from '@/lib/format';

const PLAN_ACCENTS: Record<string, { gradient: string; ring: string; badge: string }> = {
  Starter: {
    gradient: 'from-slate-600 to-slate-800',
    ring: 'ring-slate-300',
    badge: 'bg-slate-100 text-slate-700',
  },
  Pro: {
    gradient: 'from-blue-600 to-indigo-600',
    ring: 'ring-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  Enterprise: {
    gradient: 'from-purple-600 to-pink-600',
    ring: 'ring-purple-400',
    badge: 'bg-purple-100 text-purple-700',
  },
};

function getAccent(name: string) {
  return (
    PLAN_ACCENTS[name] ?? {
      gradient: 'from-blue-600 to-indigo-600',
      ring: 'ring-blue-400',
      badge: 'bg-blue-100 text-blue-700',
    }
  );
}

export function PlanGrid({ plans }: { plans: Plan[] }) {
  const { data: session } = useSession();
  const router = useRouter();

  function handleSelect(plan: Plan) {
    if (!session) {
      router.push(`/login?callbackUrl=/checkout?planId=${plan.id}`);
      return;
    }
    router.push(`/checkout?planId=${plan.id}`);
  }

  if (plans.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <p className="text-muted-foreground">Nenhum plano disponivel no momento.</p>
      </div>
    );
  }

  const featured = plans.length >= 2 ? plans[1]?.name : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const accent = getAccent(plan.name);
        const isFeatured = plan.name === featured;

        return (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border bg-card shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
              isFeatured ? `ring-2 ${accent.ring}` : 'border-border'
            }`}
          >
            {isFeatured ? (
              <div
                className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r ${accent.gradient} px-4 py-1 text-xs font-semibold text-white shadow`}
              >
                Mais popular
              </div>
            ) : null}

            {/* Header */}
            <div className={`rounded-t-2xl bg-gradient-to-br ${accent.gradient} p-6 text-white`}>
              <h3 className="text-lg font-bold">{plan.name}</h3>
              {plan.description ? (
                <p className="mt-1 text-sm text-white/70">{plan.description}</p>
              ) : null}
              <div className="mt-4">
                <span className="text-4xl font-extrabold">{formatPrice(plan.price)}</span>
                <span className="ml-1 text-sm text-white/70">
                  /{plan.interval === 'YEARLY' ? 'ano' : 'mes'}
                </span>
              </div>
              {plan.trialDays > 0 ? (
                <p className="mt-2 text-sm text-white/80">
                  {plan.trialDays} dias gratis
                </p>
              ) : null}
            </div>

            {/* Features */}
            <div className="flex flex-1 flex-col p-6">
              <ul className="flex-1 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan)}
                className={`mt-6 flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r ${accent.gradient} text-sm font-semibold text-white shadow transition-all hover:opacity-90 hover:shadow-md`}
              >
                Comecar agora
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
