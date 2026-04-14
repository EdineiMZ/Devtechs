import { HeartIcon, RocketIcon, SparklesIcon } from './icons';
import type { ComponentType, SVGProps } from 'react';

interface Differentiator {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const ITEMS: Differentiator[] = [
  {
    icon: SparklesIcon,
    title: 'Tecnologia de ponta',
    description:
      'Stack moderna, padrões de mercado e escolhas técnicas sem dívida técnica acumulada. Usamos o que há de melhor em cada camada da plataforma.',
  },
  {
    icon: HeartIcon,
    title: 'Suporte dedicado',
    description:
      'Um ponto de contato real, não um portal de tickets sem rosto. Seu time conversa com quem conhece o seu ambiente — sem escalação infinita.',
  },
  {
    icon: RocketIcon,
    title: 'Entregas rápidas',
    description:
      'Sprints curtas, deploys contínuos e feedback constante. Você vê valor em semanas, não em semestres — e sabe exatamente o que está sendo construído.',
  },
];

export function Differentiators(): JSX.Element {
  return (
    <section className="border-y border-border/60 bg-card/20 py-20 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Por que a DevTechs
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Três pilares que fazem diferença
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
          {ITEMS.map((item, index) => {
            const Icon = item.icon;
            const delayClass = [
              'animate-fade-up',
              'animate-fade-up-delay-1',
              'animate-fade-up-delay-2',
            ][index % 3];
            return (
              <div
                key={item.title}
                className={`${delayClass} flex flex-col items-center text-center`}
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-sm text-pretty leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
