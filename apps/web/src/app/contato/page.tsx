import type { Metadata } from 'next';

import { Card } from '@devtechs/ui';

import { Footer } from '@/components/landing/footer';
import { Header } from '@/components/landing/header';
import { MailIcon } from '@/components/landing/icons';

import { ContactForm } from './contact-form';

/**
 * Static-by-default — the page shell renders the same HTML for every
 * visitor, only the `<ContactForm />` island is interactive.
 */
export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Fale com o time DevTechs. Conte sobre o seu projeto, desafio ou oportunidade — respondemos em até 24 horas.',
  alternates: { canonical: '/contato' },
  openGraph: {
    title: 'Contato | DevTechs',
    description:
      'Fale com o time DevTechs. Conte sobre o seu projeto, desafio ou oportunidade.',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contato | DevTechs',
    description:
      'Fale com o time DevTechs. Conte sobre o seu projeto, desafio ou oportunidade.',
  },
};

export default function ContatoPage(): JSX.Element {
  return (
    <>
      <Header />
      <main>
        <section className="relative isolate overflow-hidden py-20 sm:py-28">
          {/* Reuse the same layered backdrop as the hero so the page
              feels like an extension of the landing, not a fork. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-grid" />
            <div className="absolute inset-0 bg-hero-glow" />
          </div>

          <div className="container max-w-2xl">
            <div className="animate-fade-up text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <MailIcon className="h-3.5 w-3.5 text-primary" />
                <span>Resposta em até 24 horas</span>
              </div>
              <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                Vamos conversar sobre o seu{' '}
                <span className="text-gradient-primary">projeto</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
                Orçamento, suporte, parceria ou só uma dúvida — preenche o
                formulário abaixo e nosso time entra em contato rapidinho.
              </p>
            </div>

            <Card
              className="animate-fade-up-delay-1 mt-12 border-border/80 bg-card/80 backdrop-blur-sm sm:p-8"
              padding="lg"
            >
              <ContactForm />
            </Card>

            <p className="animate-fade-up-delay-2 mt-6 text-center text-xs text-muted-foreground">
              Prefere email? Escreva direto para{' '}
              <a
                href="mailto:contato@devtechs.com.br"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                contato@devtechs.com.br
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
