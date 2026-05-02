'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface CashflowPoint {
  month: string;
  income: number;
  expense: number;
}

interface Props {
  data: CashflowPoint[];
}

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function CashflowChart({ data }: Props): JSX.Element {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,20%)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(215,20%,60%)' }} />
        <YAxis
          tickFormatter={(v: number) => fmt.format(v)}
          tick={{ fontSize: 11, fill: 'hsl(215,20%,60%)' }}
          width={80}
        />
        <Tooltip
          formatter={(value: number) => fmt.format(value)}
          contentStyle={{ background: 'hsl(222,47%,11%)', border: '1px solid hsl(215,20%,20%)', borderRadius: '8px' }}
          labelStyle={{ color: 'hsl(215,20%,85%)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
