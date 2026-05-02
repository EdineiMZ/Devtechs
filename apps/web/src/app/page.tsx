import { About } from '@/components/landing/about';
import { CtaFinal } from '@/components/landing/cta-final';
import { Differentiators } from '@/components/landing/differentiators';
import { Faq } from '@/components/landing/faq';
import { Hero } from '@/components/landing/hero';
import { LandingNavbar } from '@/components/landing/navbar';
import { Services } from '@/components/landing/services';
import { Stats } from '@/components/landing/stats';
import { TechStack } from '@/components/landing/tech-stack';
import { Testimonials } from '@/components/landing/testimonials';

/**
 * Landing page — pure client-side rendering for the interactive sections.
 * force-dynamic ensures the navbar can read the auth session per request.
 */
export const dynamic = 'force-dynamic';

export default function HomePage(): JSX.Element {
  return (
    <>
      <LandingNavbar />
      <main>
        <Hero />
        <TechStack />
        <Services />
        <Differentiators />
        <Stats />
        <About />
        <Testimonials />
        <Faq />
        <CtaFinal />
      </main>
    </>
  );
}
