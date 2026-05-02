'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Gmail OAuth2 callback page.
 *
 * Opened as a popup by the ConfigPanel after the user clicks
 * "Autorizar Gmail". Google redirects here with ?code=xxx.
 * This page exchanges the code via the developer-service proxy,
 * then notifies the opener and closes itself.
 */
export default function GmailCallbackPage(): JSX.Element {
  const params   = useSearchParams();
  const code     = params.get('code');
  const error    = params.get('error');
  const [status, setStatus] = useState<'exchanging' | 'success' | 'error'>('exchanging');
  const [message, setMessage] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    if (error) {
      setStatus('error');
      setMessage(`Google rejeitou a autorização: ${error}`);
      window.opener?.postMessage({ type: 'gmail-auth-error', error }, '*');
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('Código de autorização não encontrado.');
      window.opener?.postMessage({ type: 'gmail-auth-error', error: 'missing_code' }, '*');
      return;
    }

    (async () => {
      try {
        const redirectUri = `${window.location.origin}/admin/developer/gmail/callback`;
        const res = await fetch('/admin/developer/api/proxy/config/email-provider/gmail/callback', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code, redirectUri }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }

        const data = await res.json() as { user?: string };
        setStatus('success');
        setMessage(`Gmail autorizado para ${data.user ?? 'conta Google'}`);
        window.opener?.postMessage({ type: 'gmail-auth-success', user: data.user }, '*');

        setTimeout(() => window.close(), 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        setMessage(`Falha na troca do código: ${msg}`);
        window.opener?.postMessage({ type: 'gmail-auth-error', error: msg }, '*');
      }
    })();
  }, [code, error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center">
        {status === 'exchanging' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-copper/20 border-t-copper" />
            <p className="font-body text-sm text-ash">Trocando código de autorização…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-acid/10 ring-1 ring-acid/20">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-acid">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="font-display text-sm font-semibold text-foreground">Autorizado!</p>
            <p className="mt-1 font-body text-xs text-ash">{message}</p>
            <p className="mt-3 font-mono text-[10px] text-ash/50">Fechando automaticamente…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-red-400">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="font-display text-sm font-semibold text-foreground">Erro na autorização</p>
            <p className="mt-1 font-body text-xs text-red-400">{message}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 rounded-lg border border-white/8 px-4 py-2 font-body text-xs text-ash hover:text-foreground"
            >
              Fechar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
