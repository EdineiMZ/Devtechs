'use client';

import type { Plan } from '@/lib/api';
import { formatPrice } from '@/lib/format';

const COMPARISON_FEATURES = [
  'Projetos ilimitados',
  'Suporte por email',
  'Suporte prioritario',
  'SLA garantido',
  'Dashboard de DevOps',
  'Relatorios financeiros',
  'API dedicada',
  'Gerente de conta',
] as const;

/** Feature availability per plan tier — index maps to COMPARISON_FEATURES */
const FEATURE_MAP: Record<string, boolean[]> = {
  Starter: [true, true, false, false, true, false, false, false],
  Pro: [true, true, true, true, true, true, true, false],
  Enterprise: [true, true, true, true, true, true, true, true],
};

export function PlanComparison({ plans }: { plans: Plan[] }) {
  if (plans.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
              Recurso
            </th>
            {plans.map((plan) => (
              <th key={plan.id} className="px-4 py-4 text-center font-semibold text-foreground">
                <div>{plan.name}</div>
                <div className="mt-1 text-xs font-normal text-muted-foreground">
                  {formatPrice(plan.price)}/{plan.interval === 'YEARLY' ? 'ano' : 'mes'}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_FEATURES.map((feature, i) => (
            <tr key={feature} className="border-b border-border/50">
              <td className="py-3.5 pr-4 text-foreground">{feature}</td>
              {plans.map((plan) => {
                const features = FEATURE_MAP[plan.name] ?? [];
                const has = features[i] ?? false;
                return (
                  <td key={plan.id} className="px-4 py-3.5 text-center">
                    {has ? (
                      <svg
                        className="mx-auto h-5 w-5 text-emerald-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="mx-auto block h-0.5 w-4 rounded bg-muted-foreground/30" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
