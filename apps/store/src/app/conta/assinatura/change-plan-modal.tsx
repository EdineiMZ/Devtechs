'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Plan } from '@/lib/api';
import { formatPrice } from '@/lib/format';

const PAYMENTS_URL =
  process.env.NEXT_PUBLIC_PAYMENTS_URL ?? 'http://127.0.0.1:3010';

export function ChangePlanModal({
  open,
  onClose,
  currentPlanId,
}: {
  open: boolean;
  onClose: () => void;
  currentPlanId: string;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${PAYMENTS_URL}/plans`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setPlans(data as Plan[]))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const currentPlan = plans.find((p) => p.id === currentPlanId);
  const currentPrice = currentPlan ? parseFloat(currentPlan.price) : 0;

  function handleSelect(plan: Plan) {
    onClose();
    router.push(`/checkout?planId=${plan.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-bold text-foreground">Alterar plano</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione o novo plano desejado
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const planPrice = parseFloat(plan.price);
              const isUpgrade = planPrice > currentPrice;

              return (
                <div
                  key={plan.id}
                  className={`flex items-center justify-between rounded-xl border-2 p-4 ${
                    isCurrent
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {plan.name}
                      </span>
                      {isCurrent ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Atual
                        </span>
                      ) : isUpgrade ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Upgrade
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Downgrade
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-bold text-primary">
                      {formatPrice(plan.price)}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{plan.interval === 'YEARLY' ? 'ano' : 'mes'}
                      </span>
                    </p>
                  </div>
                  {!isCurrent ? (
                    <button
                      onClick={() => handleSelect(plan)}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Selecionar
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
