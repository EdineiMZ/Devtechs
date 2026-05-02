'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BurndownDataPoint {
  date: string;
  remaining: number;
  ideal: number;
  loggedOnDay: number;
}

interface Props {
  points: BurndownDataPoint[];
}

export function BurndownChart({ points }: Props): JSX.Element {
  const data = points.map((p) => ({
    ...p,
    date: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(
      new Date(p.date),
    ),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215,20%,20%)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(215,20%,60%)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(215,20%,60%)' }} />
        <Tooltip
          contentStyle={{
            background: 'hsl(222,47%,11%)',
            border: '1px solid hsl(215,20%,20%)',
            borderRadius: '8px',
          }}
          labelStyle={{ color: 'hsl(215,20%,85%)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="remaining"
          name="Horas restantes"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="ideal"
          name="Ideal"
          stroke="#6b7280"
          strokeWidth={1.5}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
