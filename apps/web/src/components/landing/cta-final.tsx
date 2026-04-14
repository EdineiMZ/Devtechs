import { Button } from '@devtechs/ui';

import { ArrowRightIcon, MailIcon } from './icons';

/**
 * Final conversion block.
 *
 * Lives inside a bordered "frame" with the same grid backdrop used in
 * the hero — visually bookending the landing page so the CTA feels
 * like a return to the top rather than an afterthought.
 */
export function CtaFinal(): JSX.Element {
  return (
    <section id="contato" className="py-20 sm:py-28">
      <div className="container">
        <div className="animate-fade-up relative isolate overflow-hidden rounded-3xl border border-border/80 bg-card/40 px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-grid opacity-70" />
            <div className="absolute inset-0 bg-hero-glow" />
          </div>

          <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Pronto para construir algo{' '}
            <span className="text-gradient-primary">extraordinário</span>?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
            Conte pra gente o seu desafio. Em menos de 24 horas nosso time
            entra em contato com um plano inicial — sem compromisso, sem
            formulário intermináveis.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
              <a href="mailto:contato@devtechs.io">
                <MailIcon className="h-4 w-4" />
                contato@devtechs.io
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full gap-2 border-border/80 sm:w-auto"
            >
              <a href="#servicos">
                Ver serviços
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
