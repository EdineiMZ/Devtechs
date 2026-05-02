import type { Config } from 'tailwindcss';

import preset from '../../packages/ui/tailwind.config';

/**
 * Tailwind config for the `@devtechs/web` landing page.
 *
 * Extends the shared `@devtechs/ui` preset so design tokens
 * (`bg-primary`, `text-muted-foreground`, etc.) stay in lock-step
 * with every shadcn/ui component rendered on the page. The `content`
 * glob includes the UI package sources so Tailwind still finds the
 * classes used by compiled components.
 */
const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink:    'hsl(var(--ink) / <alpha-value>)',
        carbon: 'hsl(var(--carbon) / <alpha-value>)',
        copper: 'hsl(var(--copper) / <alpha-value>)',
        ember:  'hsl(var(--ember) / <alpha-value>)',
        acid:   'hsl(var(--acid) / <alpha-value>)',
        ash:    'hsl(var(--ash) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body:    ['var(--font-body)',    'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'monospace'],
      },
      keyframes: {
        marquee:     { from: { transform: 'translateX(0)' },    to: { transform: 'translateX(-50%)' } },
        'marquee-rev': { from: { transform: 'translateX(-50%)' }, to: { transform: 'translateX(0)' } },
        blink:       { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'glow-acid': { '0%, 100%': { boxShadow: '0 0 20px hsl(160 100% 48% / 0.15)' }, '50%': { boxShadow: '0 0 40px hsl(160 100% 48% / 0.30)' } },
        'copper-glow-pulse': { '0%, 100%': { boxShadow: '0 0 20px hsl(28 72% 58% / 0.15)' }, '50%': { boxShadow: '0 0 40px hsl(28 72% 58% / 0.30)' } },
        'type-in':   { from: { width: '0' }, to: { width: '100%' } },
      },
      animation: {
        'marquee':      'marquee 32s linear infinite',
        'marquee-rev':  'marquee-rev 38s linear infinite',
        'blink':        'blink 1.1s step-end infinite',
        'glow-acid':    'glow-acid 3s ease-in-out infinite',
        'copper-pulse': 'copper-glow-pulse 3s ease-in-out infinite',
      },
    },
  },
};

export default config;
