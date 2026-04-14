interface Stat {
  value: string;
  label: string;
}

const STATS: Stat[] = [
  { value: '120+', label: 'Projetos entregues' },
  { value: '45', label: 'Clientes ativos' },
  { value: '8', label: 'Anos de mercado' },
  { value: '99.9%', label: 'Uptime médio' },
];

export function About(): JSX.Element {
  return (
    <section id="sobre" className="py-20 sm:py-28">
      <div className="container grid items-center gap-14 lg:grid-cols-2">
        {/* Text column */}
        <div className="animate-fade-up">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Sobre nós
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Uma empresa de tecnologia com foco em resultado
          </h2>
          <div className="mt-6 space-y-5 text-pretty leading-relaxed text-muted-foreground">
            <p>
              A DevTechs nasceu da certeza de que software bem feito transforma
              negócios de verdade. Somos uma equipe especializada em desenho de
              arquitetura, desenvolvimento sob medida e operação contínua — com
              uma obsessão saudável por qualidade, performance e previsibilidade.
            </p>
            <p>
              Trabalhamos lado a lado com o cliente do primeiro rabisco ao
              rollback em produção. Nossa entrega vai além do código:
              oferecemos processo, observabilidade e um time que realmente se
              importa com o impacto do que constrói.
            </p>
          </div>
        </div>

        {/* Stats column */}
        <div className="animate-fade-up-delay-1 grid grid-cols-2 gap-4 sm:gap-6">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-xl border border-border/80 bg-card/60 p-6 text-center transition-all hover:border-primary/60 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] sm:p-8"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              />
              <div className="relative">
                <div className="text-4xl font-bold tracking-tight text-gradient-primary sm:text-5xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground sm:text-sm">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
