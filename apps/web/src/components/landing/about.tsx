'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const STEPS = [
  {
    n: '01',
    title: 'Diagnóstico técnico',
    body: 'Revisamos seu stack atual, requisitos de negócio e restrições reais. Entregamos um documento de escopo com estimativa honesta — sem padrões inflados.',
  },
  {
    n: '02',
    title: 'Arquitetura & Prototipagem',
    body: 'Definimos o modelo de dados, endpoints da API e fluxo de autenticação antes de escrever uma linha de código de feature.',
  },
  {
    n: '03',
    title: 'Desenvolvimento iterativo',
    body: 'Sprints de 1-2 semanas com demos reais. Você testa em staging, aprova, e a feature vai para produção.',
  },
  {
    n: '04',
    title: 'Deploy & Handoff',
    body: 'Deploy com zero-downtime, documentação de API (OpenAPI/Swagger), README de operação e treinamento da sua equipe se necessário.',
  },
];

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.12 }}
      className="flex flex-col gap-4"
    >
      {/* Step number + connector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-copper/30 bg-copper/8 shrink-0">
          <span className="font-mono text-xs text-copper font-medium">{step.n}</span>
        </div>
        {index < STEPS.length - 1 && (
          <div className="hidden lg:block flex-1 h-px border-t border-dashed border-copper/20" />
        )}
      </div>

      {/* Content */}
      <div className="pl-0 lg:pl-0">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">{step.title}</h3>
        <p className="text-ash text-sm leading-relaxed font-body">{step.body}</p>
      </div>
    </motion.div>
  );
}

export function About(): JSX.Element {
  return (
    <section id="processo" className="py-24 lg:py-32 bg-ink border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-16">
          <TerminalBadge variant="acid">// como trabalhamos</TerminalBadge>
          <BlurText
            text="Do briefing ao deploy."
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 'clamp(32px, 4.5vw, 60px)' } as React.CSSProperties}
          />
          <p className="max-w-xl text-ash font-body text-base leading-relaxed">
            Um processo estruturado que elimina retrabalho e mantém você no controle.
          </p>
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((step, i) => (
            <StepCard key={step.n} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
