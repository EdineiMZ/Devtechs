import type { Config } from 'tailwindcss';

import preset from '../../packages/ui/tailwind.config';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
