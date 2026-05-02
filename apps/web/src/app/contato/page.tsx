import type { Metadata } from 'next';
import { Mail } from 'lucide-react';

import { Footer } from '@/components/landing/footer';
import { LandingNavbar } from '@/components/landing/navbar';
import { TerminalBadge } from '@/components/landing/terminal-badge';

import { ContactForm } from './contact-form';

export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Fale com o time DevsTech. Conte sobre o seu projeto, desafio ou oportunidade — respondemos em até 24 horas.',
  alternates: { canonical: '/contato' },
  openGraph: {
    title: 'Contato | DevsTech',
    description:
      'Fale com o time DevsTech. Conte sobre o seu projeto, desafio ou oportunidade.',
    type: 'website',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contato | DevsTech',
    description:
      'Fale com o time DevsTech. Conte sobre o seu projeto, desafio ou oportunidade.',
  },
};

export default function ContatoPage(): JSX.Element {
  return (
    <>
      <LandingNavbar />
      <main className="bg-ink">
        <section className="relative isolate overflow-hidden pt-32 pb-24 sm:pb-32">
          {/* Background layers */}
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            {/* Grid */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'linear-gradient(to right, hsl(160 100% 48% / 0.07) 1px, transparent 1px), linear-gradient(to bottom, hsl(160 100% 48% / 0.07) 1px, transparent 1px)',
                backgroundSize: '52px 52px',
                maskImage:
                  'radial-gradient(ellipse 70% 55% at 50% 35%, black 30%, transparent 80%)',
              }}
            />
            {/* Copper glow */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 55% 45% at 50% 60%, hsl(28 72% 58% / 0.07) 0%, transparent 70%)',
              }}
            />
            {/* Acid glow top */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 40% 30% at 50% 10%, hsl(160 100% 48% / 0.05) 0%, transparent 70%)',
              }}
            />
          </div>

          <div className="mx-auto max-w-2xl px-6 lg:px-8">
            {/* Hero */}
            <div className="animate-fade-up text-center flex flex-col items-center gap-5 mb-12">
              <TerminalBadge variant="copper">
                <Mail className="h-3 w-3" />
                {'// resposta em até 24h'}
              </TerminalBadge>

              <h1 className="font-display font-semibold text-foreground tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1 }}>
                Vamos conversar sobre o seu{' '}
                <span className="text-copper">projeto</span>
              </h1>

              <p className="max-w-lg text-ash font-body text-base leading-relaxed">
                Orçamento, suporte, parceria ou só uma dúvida — preenche o
                formulário abaixo e nosso time entra em contato rapidinho.
              </p>
            </div>

            {/* Form card */}
            <div className="animate-fade-up-delay-1 liquid-glass rounded-2xl p-8 sm:p-10">
              <ContactForm />
            </div>

            {/* Alt contact */}
            <p className="animate-fade-up-delay-2 mt-6 text-center font-mono text-xs text-ash">
              Prefere email direto?{' '}
              <a
                href="mailto:contato@devstech.com.br"
                className="text-copper hover:text-copper/80 transition-colors underline-offset-4 hover:underline"
              >
                contato@devstech.com.br
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
