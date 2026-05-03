'use client';

import Link from 'next/link';

export function PaymentSuccess() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 shadow-lg">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-foreground">Pagamento confirmado!</h2>
        <p className="mt-2 text-muted-foreground">
          Sua assinatura esta ativa. Bem-vindo ao SZDevs!
        </p>
      </div>

      <div className="mt-8 space-y-4 rounded-xl bg-muted/50 p-6">
        <h3 className="font-semibold text-foreground">Proximos passos</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            Acesse o painel em app.szdevs.com
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            Configure seus projetos e equipe
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
            Explore os modulos de DevOps, suporte e financeiro
          </li>
        </ul>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/conta/assinatura"
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
        >
          Minha assinatura
        </Link>
        <Link
          href="/planos"
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ir para plataforma
        </Link>
      </div>
    </div>
  );
}
