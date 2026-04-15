import { About } from '@/components/landing/about';
import { CtaFinal } from '@/components/landing/cta-final';
import { Differentiators } from '@/components/landing/differentiators';
import { Footer } from '@/components/landing/footer';
import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Services } from '@/components/landing/services';

/**
 * The landing page's body is pure content, but the top header needs
 * the auth session to switch the CTA between "Entrar" and
 * "Ir para a plataforma". Reading the session forces a per-request
 * render, so we let Next's default inference treat the route as
 * dynamic. A future anonymous CDN cache is still fine — the header
 * is rendered on the Node layer, not the edge.
 */
export const dynamic = 'force-dynamic';

export default function HomePage(): JSX.Element {
  return (
    <>
      <Header />
      <main id="inicio">
        <Hero />
        <Services />
        <Differentiators />
        <About />
        <CtaFinal />
      </main>
      <Footer />
    </>
  );
}
