'use client';

import { useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const STATS = [
  { value: '40+',   raw: 40,  suffix: '+',  label: 'projetos entregues' },
  { value: '99.8%', raw: 99.8, suffix: '%', label: 'uptime médio em produção' },
  { value: '< 2s',  raw: null, suffix: '',  label: 'tempo médio de resposta de API' },
  { value: '100%',  raw: 100, suffix: '%',  label: 'repositório entregue ao cliente' },
];

function CountUp({ raw, suffix, display }: { raw: number | null; suffix: string; display: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!inView || raw === null) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * raw * 10) / 10);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, raw]);

  if (raw === null) return <span ref={ref}>{display}</span>;
  const formatted = Number.isInteger(raw) ? Math.round(val) : val.toFixed(1);
  return <span ref={ref}>{formatted}{suffix}</span>;
}

export function Stats(): JSX.Element {
  return (
    <section className="relative py-24 bg-ink border-y border-white/5 overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, hsl(28 72% 58% / 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-0 lg:divide-x lg:divide-white/10">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center gap-2 px-4">
              <span className="font-display text-5xl lg:text-6xl font-bold text-copper leading-none">
                <CountUp raw={stat.raw} suffix={stat.suffix} display={stat.value} />
              </span>
              <span className="font-mono text-xs text-ash uppercase tracking-widest leading-relaxed">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
