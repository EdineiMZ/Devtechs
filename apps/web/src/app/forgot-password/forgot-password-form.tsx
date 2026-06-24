'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Input } from '@szdevs/ui';

import { requestPasswordReset } from './actions';

export function ForgotPasswordForm(): JSX.Element {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const emailFromQuery = searchParams?.get('email');
    if (emailFromQuery) setEmail(emailFromQuery.toLowerCase());
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setError(null);
    setLoading(true);

    const result = await requestPasswordReset(email.trim().toLowerCase());
    setLoading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="space-y-4">
        <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
          <p className="font-semibold">Link enviado</p>
          <p className="mt-1 opacity-90">
            Se existir uma conta para este e-mail, você receberá um link de redefinição válido por 5
            minutos. Confira sua caixa de entrada.
          </p>
        </div>
        <Link href="/login">
          <Button variant="outline" size="lg" className="w-full">
            Voltar ao login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-semibold">Erro</p>
          <p className="mt-1 opacity-90">{error}</p>
        </div>
      ) : null}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      <Button
        type="submit"
        variant="copper"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={!email.trim() || loading}
      >
        {loading ? 'Enviando…' : 'Enviar link de recuperação'}
      </Button>
    </form>
  );
}
