/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

/**
 * Next.js 14 config (CommonJS). Mirrors `next.config.ts` 1-to-1 — when
 * we're on Next 15+, delete this file and the `.ts` flavor takes over
 * automatically (no other change needed).
 *
 * Performance flags worth knowing about:
 *   - `compress: true`      → gzip/brotli on every response in prod.
 *   - `poweredByHeader: false` → drops the `X-Powered-By: Next.js`
 *     fingerprint (small but free security win).
 *   - `images.remotePatterns` → only allowlist hostnames you actually
 *     serve; wildcard `*` is a leaky-bucket abuse vector.
 *   - `experimental.optimizePackageImports` → tree-shakes large libs
 *     (lucide-react, date-fns, …) without the consumer doing anything.
 *   - Bundle analyzer → `pnpm --filter @devtechs/web build:analyze`.
 *
 * Standalone output stays on (we ship Docker images that copy
 * `.next/standalone/`), and `outputFileTracingRoot` keeps the file
 * tracer following workspace symlinks out of `apps/web` into
 * `packages/*`.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  transpilePackages: ['@devtechs/ui', '@devtechs/types'],

  output: 'standalone',

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // Keep this list tight. When you start serving images from a CDN
    // (e.g. R2, S3, Cloudinary), add a single hostname here.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/a/**',
      },
    ],
  },

  experimental: {
    // Keep the file tracer following workspace symlinks out of `apps/web`
    // into `packages/*` — needed for `output: 'standalone'` Docker builds.
    outputFileTracingRoot: path.join(__dirname, '../../'),
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
    // Server actions are on by default in 14.2; bumping the body
    // limit just for big-form scenarios (CSV upload, PDF preview).
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },

  async headers() {
    // Sane defaults for everything served from this app. The CSP is
    // intentionally NOT set here — that lives in middleware so the
    // nonces can be computed per-request.
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

// Only load bundle-analyzer when explicitly requested — requiring it
// unconditionally injects a webpack() hook that conflicts with Turbopack.
if (process.env.ANALYZE === 'true') {
  const withBundleAnalyzer = require('@next/bundle-analyzer')({ enabled: true });
  module.exports = withBundleAnalyzer(nextConfig);
} else {
  module.exports = nextConfig;
}
