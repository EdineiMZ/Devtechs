'use client';

import { useState } from 'react';

import { Button } from '@szdevs/ui';

import { authServiceFetch, extractErrorMessage } from '@/lib/auth-service';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; expiresAt: string }
  | { kind: 'error'; message: string };

/**
 * Client island that POSTs to the auth-service
 * `/auth/email/send-verification` endpoint using the access token
 * passed down from the server page.
 *
 * Why client-side (rather than a server action): the auth-service
 * is rate-limited per-user (3/hour) AND the endpoint wants the
 * access token in the `Authorization` header. Keeping the call in
 * the browser means the token never leaves the user's session
 * cookie flow — no need to mint a new one for a server action.
 */
interface ResendVerificationButtonProps {
  accessToken: string;
}

export function ResendVerificationButton({
  accessToken,
}: ResendVerificationButtonProps): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleClick = async (): Promise<void> => {
    setStatus({ kind: 'loading' });
    const res = await authServiceFetch<{ message: string; expiresAt: string }>(
      '/auth/email/send-verification',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
      setStatus({ kind: 'error', message: extractErrorMessage(res.data) });
      return;
    }
    const body = res.data as { expiresAt: string };
    setStatus({ kind: 'success', expiresAt: body.expiresAt });
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={handleClick}
        loading={status.kind === 'loading'}
        disabled={status.kind === 'loading'}
      >
        {status.kind === 'loading' ? 'Reenviando…' : 'Reenviar verificação'}
      </Button>

      {status.kind === 'success' ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-center text-xs text-emerald-300"
        >
          Email reenviado. O link expira em{' '}
          {new Date(status.expiresAt).toLocaleString('pt-BR')}.
        </p>
      ) : null}

      {status.kind === 'error' ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-center text-xs text-destructive"
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
