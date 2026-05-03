'use client';

import { motion } from 'framer-motion';
import { Code2, GitBranch, HeartHandshake, Zap } from 'lucide-react';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const REASONS = [
  {
    n: '01',
    icon: Code2,
    title: 'Backend-first',
    body: 'Nossa especialidade é a fundação: banco de dados bem modelado, API coesa, lógica de negócio testável. O frontend é uma consequência natural disso.',
  },
  {
    n: '02',
    icon: GitBranch,
    title: 'Código auditável',
    body: 'Tudo com controle de versão, PR reviews, testes automatizados e documentação inline. Você recebe o repositório, não uma caixa preta.',
  },
  {
    n: '03',
    icon: Zap,
    title: 'Entrega iterativa',
    body: 'Ciclos curtos com demonstrações reais. Você vê progresso toda semana, não só na data de entrega final.',
  },
  {
    n: '04',
    icon: HeartHandshake,
    title: 'Comunicação direta',
    body: 'Um canal, uma pessoa de contato. Sem intermediários, sem reuniões desnecessárias, sem surpresas no escopo.',
  },
];

export function Differentiators(): JSX.Element {
  return (
    <section id="diferenciais" className="py-24 lg:py-32 bg-ink">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col gap-4 mb-14">
          <TerminalBadge variant="copper">{'// por que a SZDevs'}</TerminalBadge>
          <BlurText
            text="Engenharia sem verniz."
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 'clamp(32px, 4.5vw, 60px)' } as React.CSSProperties}
          />
          <p className="max-w-xl text-ash font-body text-base leading-relaxed">
            Sem jargão vazio. Sem estimativas fantasiosas. Apenas código bem escrito e entregue no prazo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {REASONS.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.n}
                className="liquid-glass rounded-2xl p-8 relative overflow-hidden group cursor-default"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {/* Decorative number */}
                <span
                  aria-hidden
                  className="absolute top-4 right-6 font-mono text-7xl font-bold text-white/[0.04] select-none leading-none"
                >
                  {item.n}
                </span>

                {/* Copper glow on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ boxShadow: '0 0 0 1px hsl(28 72% 58% / 0.25), 0 0 32px hsl(28 72% 58% / 0.08)' }}
                />

                <Icon className="h-6 w-6 text-acid mb-4 relative z-10" />
                <h3 className="font-display text-lg font-semibold text-foreground mb-2 relative z-10">
                  {item.title}
                </h3>
                <p className="text-ash text-sm leading-relaxed font-body relative z-10 max-w-md">
                  {item.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
