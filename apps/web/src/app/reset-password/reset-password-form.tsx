'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input } from '@szdevs/ui';

import { resetPassword } from './actions';

interface ResetPasswordFormProps {
  token: string;
  email: string;
}

export function ResetPasswordForm({ token, email }: ResetPasswordFormProps): JSX.Element {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (pwd: string, confirm: string): string | null => {
    if (pwd.length < 10) return 'Use ao menos 10 caracteres.';
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const varietyCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (varietyCount < 3) return 'Use ao menos três tipos entre letras, números e símbolos.';
    if (pwd !== confirm) return 'As senhas precisam ser iguais.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const vErr = validate(password, confirmPassword);
    if (vErr) {
      setValidationError(vErr);
      return;
    }
    setValidationError(null);
    setError(null);
    setLoading(true);

    const result = await resetPassword(token, email, password);
    setLoading(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.replace('/login'), 1500);
  };

  if (success) {
    return (
      <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-primary">
        <p className="font-semibold">Senha atualizada</p>
        <p className="mt-1 opacity-90">Sua senha foi redefinida. Você será redirecionado para o login.</p>
      </div>
    );
  }

  const forgotHref = `/forgot-password?email=${encodeURIComponent(email)}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <div role="alert" className="space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div>
            <p className="font-semibold">Não foi possível redefinir a senha</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
          <Link href={forgotHref}>
            <Button type="button" size="sm" variant="outline" className="border-destructive/60 text-destructive">
              Solicitar novo link
            </Button>
          </Link>
        </div>
      ) : null}

      {validationError ? (
        <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{validationError}</p>
        </div>
      ) : null}

      <Input
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        hint="Mínimo 10 caracteres com letras, números e símbolos."
      />

      <Input
        label="Confirmar nova senha"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
      />

      <Button
        type="submit"
        variant="copper"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={!password || !confirmPassword || loading}
      >
        {loading ? 'Atualizando…' : 'Definir nova senha'}
      </Button>
    </form>
  );
}
