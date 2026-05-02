'use client';

import { useState } from 'react';

import { fmtDate } from '@/lib/fmt-date';
import type { LicensedProduct } from '@/lib/license-api';

import { CreateProductDialog } from './create-product-dialog';
import { EditProductDialog } from './edit-product-dialog';

interface ProductsSectionProps {
  products: LicensedProduct[];
  canCreate: boolean;
}

export function ProductsSection({ products, canCreate }: ProductsSectionProps): JSX.Element {
  const [filter, setFilter] = useState('');

  const filtered = filter.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.appId.toLowerCase().includes(filter.toLowerCase()),
      )
    : products;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Produtos licenciados</h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Filtrar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-lg border border-white/8 bg-background px-3 text-xs text-foreground placeholder:text-ash focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          {canCreate ? <CreateProductDialog /> : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] py-10 text-center text-sm text-ash">
          {filter ? 'Nenhum produto encontrado para o filtro.' : 'Nenhum produto cadastrado ainda.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.04] text-left text-xs font-medium text-ash">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">App ID</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Criado em</th>
                {canCreate ? <th className="px-4 py-3">Ação</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-white/[0.03] px-1.5 py-0.5 text-xs text-foreground/80">
                      {p.appId}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-ash">
                    {p.description ?? <span className="italic opacity-50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ash">
                    {fmtDate(p.createdAt)}
                  </td>
                  {canCreate ? (
                    <td className="px-4 py-3">
                      <EditProductDialog product={p} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
