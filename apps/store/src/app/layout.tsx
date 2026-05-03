import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';

import '@/styles/globals.css';

export const metadata = {
  title: 'SZDevs - Planos e Assinatura',
  description: 'Gerencie sua assinatura SZDevs',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
