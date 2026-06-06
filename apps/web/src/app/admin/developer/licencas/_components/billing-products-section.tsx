import Link from 'next/link';

import type { BillingProduct } from '@/lib/recurring-billing-api';

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

interface Props {
  products: BillingProduct[];
}

export function BillingProductsSection({ products }: Props): JSX.Element {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Produtos/Serviços Licenciados</h2>
          <p className="text-xs text-ash mt-0.5">
            Produtos do catálogo financeiro marcados como licenciados. Gerencie em{' '}
            <Link
              href="/admin/financeiro/produtos"
              className="text-blue-400 hover:underline"
            >
              Financeiro → Produtos & Serviços
            </Link>
            .
          </p>
        </div>
        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
          {products.length} produto{products.length !== 1 ? 's' : ''}
        </span>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-ash">
          Nenhum produto licenciado cadastrado ainda.{' '}
          <Link href="/admin/financeiro/produtos" className="text-blue-400 hover:underline">
            Cadastrar produto
          </Link>{' '}
          e marcar como licenciado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-medium text-ash">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ash">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ash">Preço unitário</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ash">Unidade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ash">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-ash mt-0.5 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ash">
                    {p.category ?? <span className="text-white/20">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{formatBRL(p.unitPrice)}</td>
                  <td className="px-4 py-3 text-ash">{p.unit}</td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-ash">
                        Inativo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
