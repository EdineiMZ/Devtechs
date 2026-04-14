import Link from 'next/link';

import { Button } from '@devtechs/ui';

import { ArrowRightIcon, SparklesIcon } from './icons';

/**
 * Hero — the above-the-fold moment.
 *
 * Layered background (bottom-up):
 *   1. `bg-background` (base near-black)
 *   2. `.bg-grid` faint grid with a radial mask so edges fade out
 *   3. `.bg-hero-glow` radial electric-blue glow behind the headline
 *
 * All three live behind the content via an absolutely-positioned
 * `<div aria-hidden>` so they don't affect the document flow or a11y.
 */
export function Hero(): JSX.Element {
  return (
    <section
      id="inicio"
      className="relative isolate overflow-hidden pb-20 pt-28 sm:pb-28 sm:pt-36"
    >
      {/* Background layers */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 bg-hero-glow animate-glow-pulse" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>

      <div className="container max-w-4xl text-center">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          <SparklesIcon className="h-3.5 w-3.5 text-primary" />
          <span>Tecnologia que impulsiona o seu negócio</span>
        </div>

        <h1 className="animate-fade-up-delay-1 mt-8 text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          Soluções em software que <span className="text-gradient-primary">transformam</span>
          <br className="hidden sm:block" /> o futuro da sua empresa
        </h1>

        <p className="animate-fade-up-delay-2 mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg md:text-xl">
          Desenvolvimento sob medida, plataforma DevOps, suporte técnico
          especializado e consultoria em infraestrutura cloud — tudo sob um
          único parceiro de confiança.
        </p>

        <div className="animate-fade-up-delay-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
            <a href="#contato">
              Fale conosco
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full gap-2 border-border/80 sm:w-auto"
          >
            <Link href="/login">Entrar na Plataforma</Link>
          </Button>
        </div>

        <div className="animate-fade-up-delay-4 mt-12 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Plataforma online
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Suporte 24/7</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">SLA garantido</span>
        </div>
      </div>
    </section>
  );
}
