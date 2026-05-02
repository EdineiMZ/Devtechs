'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button, Input } from '@devtechs/ui';

import { verifyTwoFaSession } from './actions';

interface Props {
  callbackUrl: string;
  accessToken: string;
}

export function TwoFaVerifyForm({ callbackUrl, accessToken }: Props): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await verifyTwoFaSession(code.trim(), accessToken, callbackUrl);
      if (!result.ok) {
        setError(result.message ?? 'Código incorreto. Tente novamente.');
        return;
      }
      // Server action updated the session — navigate to the callback.
      router.replace(callbackUrl);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div
        role="status"
        className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary"
      >
        <p className="font-semibold">Verificação obrigatória</p>
        <p className="mt-1 opacity-90">
          Sua conta tem a verificação em duas etapas ativada. Informe o código
          de 6 dígitos do seu aplicativo autenticador para continuar.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-semibold">Verificação falhou</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Código do autenticador"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          hint="6 dígitos do seu aplicativo autenticador (Google Authenticator, Authy etc.)"
          disabled={isPending}
        />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          disabled={code.length !== 6 || isPending}
        >
          {isPending ? 'Verificando…' : 'Verificar e continuar'}
        </Button>
      </form>
    </div>
  );
}
