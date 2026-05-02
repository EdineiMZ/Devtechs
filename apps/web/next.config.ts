import path from 'node:path';

import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

/**
 * TypeScript flavor of the Next.js config. Native `next.config.ts`
 * support landed in Next.js 15. Until this repo upgrades, the
 * sibling `next.config.js` is the file Next actually loads — keep
 * both in lock-step. After upgrading to Next 15+, delete the `.js`
 * file and Next picks up this one.
 */

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  transpilePackages: ['@devtechs/ui', '@devtechs/types'],

  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/u/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/a/**' },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
