'use client';

import { Fragment, useState } from 'react';

import { fmtDate, fmtDateTime } from '@/lib/fmt-date';
import type { ActivationToken, LicensedProduct, TokenStatus } from '@/lib/license-api';

import { RevokeTokenDialog } from './revoke-token-dialog';

interface TokensSectionProps {
  tokens: ActivationToken[];
  products: LicensedProduct[];
}

const STATUS_LABEL: Record<TokenStatus, string> = {
  ACTIVE: 'Ativo',
  REVOKED: 'Revogado',
  EXPIRED: 'Expirado',
};

const STATUS_CLASS: Record<TokenStatus, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  REVOKED: 'bg-destructive/15 text-destructive',
  EXPIRED: 'bg-white/5 text-ash',
};

export function TokensSection({ tokens, products }: TokensSectionProps): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<TokenStatus | 'ALL'>('ALL');
  const [productFilter, setProductFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = tokens.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (productFilter && t.productId !== productFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.key.toLowerCase().includes(q) ||
        t.clientId.toLowerCase().includes(q) ||
        t.product?.name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Tokens de ativação</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Buscar key ou cliente…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 rounded-lg border border-white/8 bg-background px-3 text-xs text-foreground placeholder:text-ash focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="h-8 rounded-lg border border-white/8 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">Todos produtos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TokenStatus | 'ALL')}
            className="h-8 rounded-lg border border-white/8 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">Todos status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="REVOKED">Revogados</option>
            <option value="EXPIRED">Expirados</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] py-10 text-center text-sm text-ash">
          Nenhum token encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.04] text-left text-xs font-medium text-ash">
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Key (prefixo)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ativações</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Emitido em</th>
                <th className="px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((t) => (
                <Fragment key={t.id}>
                  <tr
                    key={t.id}
                    className="cursor-pointer hover:bg-white/[0.03]"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {t.product?.name ?? t.productId}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-white/[0.03] px-1.5 py-0.5 text-xs text-foreground/80">
                        {t.key.substring(0, 18)}…
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {t.usedCount}
                      {t.maxUses !== null ? ` / ${t.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {t.expiresAt
                        ? fmtDate(t.expiresAt)
                        : <span className="italic opacity-50">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ash">
                      {fmtDate(t.issuedAt)}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <RevokeTokenDialog token={t} />
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === t.id && (
                    <tr key={`${t.id}-detail`} className="bg-white/[0.02]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-ash">
                              Hash SHA-256
                            </p>
                            <code className="mt-1 block break-all font-mono text-xs text-foreground/70">
                              {t.hash}
                            </code>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-ash">
                              Hardware ID
                            </p>
                            <p className="mt-1 text-xs text-foreground">
                              {t.hardwareId ?? <span className="italic opacity-50">Nenhum</span>}
                            </p>
                          </div>
                          {t.revokedAt && (
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-wider text-ash">
                                Revogado em
                              </p>
                              <p className="mt-1 text-xs text-foreground">
                                {fmtDateTime(t.revokedAt)}
                              </p>
                              {t.revokeReason && (
                                <p className="mt-0.5 text-xs text-ash">
                                  Motivo: {t.revokeReason}
                                </p>
                              )}
                            </div>
                          )}
                          {t.activations && t.activations.length > 0 && (
                            <div className="sm:col-span-2">
                              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ash">
                                Últimas ativações
                              </p>
                              <div className="space-y-1">
                                {t.activations.map((a) => (
                                  <p key={a.id} className="text-xs text-foreground/70">
                                    {fmtDateTime(a.activatedAt)}
                                    {a.ipAddress ? ` — IP: ${a.ipAddress}` : ''}
                                    {a.hardwareId ? ` — HW: ${a.hardwareId}` : ''}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
