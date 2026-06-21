'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TenantAiSpendingRow } from '@/lib/agrivor-api';

interface Props {
  tenants: TenantAiSpendingRow[];
}

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export function AiSpendingChart({ tenants }: Props): JSX.Element {
  const data = tenants
    .slice()
    .sort((a, b) => b.consumedCents - a.consumedCents)
    .slice(0, 12)
    .map((t) => ({
      name: t.tenantName.length > 14 ? `${t.tenantName.slice(0, 13)}…` : t.tenantName,
      gasto: t.consumedCents / 100,
      cota: t.hardQuotaCents / 100,
      percentUsed: t.percentUsed,
    }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,20%)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={48}
        />
        <YAxis
          tickFormatter={(v: number) => fmt.format(v)}
          tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }}
          width={80}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            fmt.format(value),
            name === 'gasto' ? 'Gasto' : 'Cota máxima',
          ]}
          contentStyle={{
            background: 'hsl(222,47%,11%)',
            border: '1px solid hsl(215,20%,20%)',
            borderRadius: '8px',
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(215,20%,85%)' }}
        />
        <Bar dataKey="cota" name="Cota máxima" fill="hsl(215,20%,25%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="gasto" name="Gasto" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.percentUsed >= 100
                  ? '#ef4444'
                  : entry.percentUsed >= 80
                    ? '#f59e0b'
                    : '#22c55e'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
