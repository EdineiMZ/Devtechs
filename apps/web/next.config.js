const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@devtechs/ui', '@devtechs/types'],

  // `output: 'standalone'` produces a minimal self-contained server
  // bundle under `.next/standalone` that the Docker runtime stage
  // ships as-is (~50MB instead of copying the full node_modules).
  //
  // `outputFileTracingRoot` points at the workspace root so Next's
  // file-tracer follows `transpilePackages` out of apps/web into the
  // `packages/*` workspaces. Without this flag standalone output is
  // broken for any monorepo that uses workspace-linked packages.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
