/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@szdevs/ui', '@szdevs/types'],
};

module.exports = nextConfig;
