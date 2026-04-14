import { About } from '@/components/landing/about';
import { CtaFinal } from '@/components/landing/cta-final';
import { Differentiators } from '@/components/landing/differentiators';
import { Footer } from '@/components/landing/footer';
import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { Services } from '@/components/landing/services';

/**
 * Force the App Router to statically generate this page. The landing
 * is pure content with no per-request data, so it should be served as
 * a flat HTML file from the edge with zero cold-start cost.
 *
 * `revalidate: false` keeps it permanently cached until the next
 * deploy; a future CMS integration can switch this to a number (ISR)
 * without touching any component below.
 */
export const dynamic = 'force-static';
export const revalidate = false;

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
