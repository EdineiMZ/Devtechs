'use client';

import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { BlurText } from './blur-text';
import { TerminalBadge } from './terminal-badge';

const CODE_LINES = [
  { delay: 0,    text: '$ nest start --watch auth-service',        color: 'text-acid' },
  { delay: 0.8,  text: '[Nest] LOG  NestApplication started',       color: 'text-ash' },
  { delay: 1.4,  text: '[auth] LOG  Listening on :4001',            color: 'text-ash' },
  { delay: 2.2,  text: '$ prisma migrate deploy --schema=./schema', color: 'text-copper' },
  { delay: 3.0,  text: 'Applying migration 0042_user_schema…',      color: 'text-ash' },
  { delay: 3.6,  text: '✔ Migration applied successfully',          color: 'text-acid' },
  { delay: 4.4,  text: '$ docker compose up -d postgres redis',     color: 'text-copper' },
  { delay: 5.2,  text: '[+] Running 2/2 containers',                color: 'text-acid' },
  { delay: 6.0,  text: '$ pnpm test -- --coverage',                 color: 'text-copper' },
  { delay: 6.8,  text: 'Tests: 142 passed, 0 failed',               color: 'text-acid' },
];

function TerminalAnimation() {
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    CODE_LINES.forEach((line, i) => {
      const t = setTimeout(() => setVisible((p) => [...p, i]), line.delay * 1000);
      return () => clearTimeout(t);
    });
  }, []);

  return (
    <div className="terminal-card rounded-xl p-5 text-xs leading-6 overflow-hidden">
      <div className="flex items-center gap-1.5 mb-4">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-ash text-[10px] font-mono">~/devstechs — bash</span>
      </div>
      {CODE_LINES.map((line, i) => (
        <div
          key={i}
          className={`transition-opacity duration-500 ${visible.includes(i) ? 'opacity-100' : 'opacity-0'} ${line.color}`}
        >
          {line.text}
          {i === visible[visible.length - 1] && visible.length < CODE_LINES.length && (
            <span className="cursor-blink" />
          )}
        </div>
      ))}
      {visible.length === CODE_LINES.length && (
        <div className="text-ash mt-1 cursor-blink"> </div>
      )}
    </div>
  );
}

export function Hero(): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = scrollRef.current;
      if (!el) return;
      const rect  = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section ref={scrollRef} id="inicio" className="relative min-h-screen overflow-hidden">
      {/* ── Background layers ── */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* Dark ink base */}
        <div className="absolute inset-0 bg-ink" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, hsl(160 100% 48% / 0.08) 1px, transparent 1px), linear-gradient(to bottom, hsl(160 100% 48% / 0.08) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)',
          }}
        />
        {/* Copper radial glow */}
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: 'radial-gradient(ellipse 55% 45% at 30% 55%, hsl(28 72% 58% / 0.10) 0%, transparent 70%)',
          }}
        />
        {/* Acid radial glow */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: 'radial-gradient(ellipse 40% 35% at 70% 30%, hsl(160 100% 48% / 0.07) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative mx-auto max-w-7xl px-6 pt-32 pb-20 lg:px-8 lg:pt-36 lg:pb-28">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-12 items-center min-h-[calc(100vh-8rem)]">
          {/* Left — headline */}
          <div className="flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <TerminalBadge variant="acid">// engenharia de produto</TerminalBadge>
            </motion.div>

            <BlurText
              as="h1"
              text="Software que move negócios."
              startDelay={0.1}
              className="font-display font-semibold leading-none tracking-tight text-foreground"
              style={{ fontSize: 'clamp(42px, 6vw, 80px)' } as React.CSSProperties}
            />

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="max-w-lg text-base text-ash leading-relaxed font-body"
            >
              Da arquitetura ao deploy. A DevsTech constrói sistemas backend, APIs e produtos
              digitais que resistem à escala real.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Link
                href="#cta"
                className="inline-flex items-center justify-center rounded-md bg-copper px-6 py-3 text-sm font-semibold text-ink transition-all hover:bg-copper/85 copper-glow"
              >
                Iniciar projeto
              </Link>
              <a
                href="#servicos"
                className="liquid-glass-strong inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-body text-ash hover:text-foreground transition-colors"
              >
                Ver como funciona
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.1 }}
              className="flex items-center gap-2 text-xs font-mono text-ash"
            >
              <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
              role para explorar
            </motion.div>
          </div>

          {/* Right — terminal animation */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <TerminalAnimation />
          </motion.div>
        </div>
      </div>

      {/* Scroll progress indicator */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col items-center gap-1">
        <div className="h-[30vh] w-0.5 rounded-full bg-white/10 relative overflow-hidden">
          <div
            className="absolute inset-x-0 top-0 bg-copper rounded-full transition-all duration-100"
            style={{ height: `${scrollProgress * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
