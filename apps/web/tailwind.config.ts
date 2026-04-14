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
};

export default config;
