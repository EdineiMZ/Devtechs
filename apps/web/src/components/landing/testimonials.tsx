'use client';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const TESTIMONIALS = [
  {
    quote: 'A SZDevs foi a primeira agência que nos entregou uma API documentada de verdade. Conseguimos contratar um dev júnior e ele entendeu o sistema no primeiro dia.',
    name: 'Rafael Costa',
    role: 'CTO, Fintech Startup',
  },
  {
    quote: 'Esperava a entrega genérica de sempre. Recebi um relatório de pentest de 40 páginas com cada vulnerabilidade categorizada e priorizada. Impressionante.',
    name: 'Mariana Lopes',
    role: 'CEO, SaaS B2B',
  },
  {
    quote: 'O banco de dados estava um caos. Em duas semanas de consultoria, as queries caíram de 8s para 180ms. Sem mágica — só modelagem correta.',
    name: 'Diego Ferreira',
    role: 'Engenheiro Sênior, E-commerce',
  },
  {
    quote: 'O que me conquistou foi a honestidade no escopo. Quando pedimos algo inviável, explicaram o porquê e sugeriram uma alternativa melhor. Raro num fornecedor.',
    name: 'Camila Souza',
    role: 'Product Manager, Healthtech',
  },
  {
    quote: 'Migramos de NestJS para Next.js API Routes e o deploy passou a funcionar na primeira tentativa. Nunca tinha tido isso com outra agência.',
    name: 'Bruno Alves',
    role: 'Fundador, Plataforma EdTech',
  },
  {
    quote: 'Transparência total nos PRs, código limpo, comentários em português para o time. Exatamente o que precisávamos para crescer sem depender deles para sempre.',
    name: 'Juliana Martins',
    role: 'Diretora de TI, Construtora Digital',
  },
];

function TestimonialCard({ quote, name, role }: (typeof TESTIMONIALS)[0]) {
  return (
    <div className="liquid-glass rounded-2xl p-6 shrink-0 w-80">
      <p className="text-sm leading-relaxed text-foreground/90 font-body mb-4 before:content-['“'] before:text-copper before:font-display before:text-2xl before:mr-1 before:leading-none before:align-[-0.2em]">
        {quote}
      </p>
      <div>
        <p className="font-display text-sm font-semibold text-foreground">{name}</p>
        <p className="font-mono text-xs text-ash mt-0.5">{role}</p>
      </div>
    </div>
  );
}

function MarqueeRow({ items, reverse = false }: { items: typeof TESTIMONIALS; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden mask-fade-x">
      <div className={`flex gap-4 w-max ${reverse ? 'animate-marquee-rev' : 'animate-marquee'}`}>
        {doubled.map((item, i) => (
          <TestimonialCard key={i} {...item} />
        ))}
      </div>
    </div>
  );
}

export function Testimonials(): JSX.Element {
  const row1 = TESTIMONIALS.slice(0, 3);
  const row2 = TESTIMONIALS.slice(3);

  return (
    <section id="cases" className="py-24 lg:py-32 bg-ink border-t border-white/5 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 mb-14">
        <div className="flex flex-col gap-4">
          <TerminalBadge variant="acid">{'// o que dizem'}</TerminalBadge>
          <BlurText
            text="Clientes que constroem com a gente."
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 'clamp(28px, 4vw, 54px)' } as React.CSSProperties}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <MarqueeRow items={row1} />
        <MarqueeRow items={row2} reverse />
      </div>
    </section>
  );
}
