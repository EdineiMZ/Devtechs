import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@devtechs/ui';

import {
  CloudIcon,
  CodeIcon,
  DevOpsIcon,
  SupportIcon,
} from './icons';
import type { ComponentType, SVGProps } from 'react';

interface ServiceItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}

const SERVICES: ServiceItem[] = [
  {
    icon: CodeIcon,
    title: 'Desenvolvimento de Sistemas',
    description:
      'Aplicações web, APIs e sistemas internos desenhados sob medida para o seu processo. Do MVP ao produto em escala, com testes, CI/CD e arquitetura moderna.',
  },
  {
    icon: DevOpsIcon,
    title: 'Plataforma DevOps',
    description:
      'Pipelines de CI/CD, observabilidade completa, deploy automatizado e rollback sob demanda. Sua engenharia entrega mais rápido e com segurança.',
  },
  {
    icon: SupportIcon,
    title: 'Suporte Técnico Especializado',
    description:
      'Atendimento com SLA garantido, monitoramento proativo e resposta 24/7. Um time dedicado que conhece o seu ambiente e fala a sua linguagem.',
  },
  {
    icon: CloudIcon,
    title: 'Infraestrutura Cloud',
    description:
      'Consultoria e gestão multi-cloud (AWS, GCP, Cloudflare). Arquitetura escalável, custos sob controle e segurança como prioridade desde o dia zero.',
  },
];

/**
 * Four service cards in a responsive grid.
 *
 * Mobile: single column, stacked.
 * md (>=768px): 2 columns.
 * lg (>=1024px): 4 columns.
 *
 * Each card uses shadcn/ui `Card` from `@devtechs/ui` and adds a
 * hover-reactive primary-tinted border so the grid feels alive
 * without any JS or library-level animation.
 */
export function Services(): JSX.Element {
  return (
    <section id="servicos" className="py-20 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            O que fazemos
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Um portfólio completo para sua stack tecnológica
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Quatro frentes de atuação que, juntas, cobrem todo o ciclo de
            vida da tecnologia na sua empresa — da primeira linha de código
            ao rollback em produção.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, index) => {
            const Icon = service.icon;
            // Tailwind's JIT compiler needs the class literal present at
            // build time, so the delay is selected from a fixed set of
            // utility classes rather than computed at runtime.
            const delayClass = [
              'animate-fade-up',
              'animate-fade-up-delay-1',
              'animate-fade-up-delay-2',
              'animate-fade-up-delay-3',
            ][index % 4];
            return (
              <Card
                key={service.title}
                className={`${delayClass} group relative overflow-hidden border-border/80 bg-card/60 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)]`}
              >
                {/* Subtle gradient overlay that brightens on hover */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/0 via-primary/0 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-primary/5"
                />
                <CardHeader className="pb-4">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15 group-hover:ring-primary/40">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-pretty leading-relaxed">
                    {service.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
