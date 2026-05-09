import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { Providers } from '@/components/auth/providers';

import './globals.css';

/**
 * Inter is loaded through `next/font/google` which self-hosts the
 * woff2 files at build time, so the page ships zero font requests to
 * Google at runtime. The font is exposed as a CSS variable so our
 * `body { font-family: var(--font-sans) }` rule can pick it up.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const SITE_NAME = 'SZDevs';
const SITE_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://szdevs.com';
const SITE_TITLE = 'SZDevs — Tecnologia sob medida para o seu negócio';
const SITE_DESCRIPTION =
  'Desenvolvimento de sistemas customizados, plataforma DevOps, suporte técnico especializado e consultoria em infraestrutura cloud. Entregas rápidas, tecnologia de ponta e atendimento dedicado.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    'desenvolvimento de sistemas',
    'plataforma devops',
    'suporte técnico',
    'infraestrutura cloud',
    'consultoria em TI',
    'software sob medida',
    'SZDevs',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — tecnologia sob medida`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
    creator: '@SZDevs',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

/**
 * Viewport / theme-color metadata is exported separately in Next 14+
 * — `metadata` is reserved for the serialisable document head.
 */
export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * Global document shell.
 *
 * - `className="dark"` keeps shadcn/ui components on their dark
 *   variants regardless of OS preferences. The landing page is
 *   designed as a dark-first experience; we add `suppressHydrationWarning`
 *   for when a future theme toggle starts mutating the class from
 *   client code.
 * - `className={inter.variable}` injects the `--font-sans` custom
 *   property at the root so every descendant inherits it.
 */
export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="pt-BR" className={`dark ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
