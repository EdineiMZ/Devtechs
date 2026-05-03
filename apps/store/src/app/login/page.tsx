import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar - SZDevs' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600">
            <span className="text-lg font-bold text-white">D</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">SZDevs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre para gerenciar sua assinatura
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
