'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@devtechs/ui';

/**
 * Google + GitHub sign-in buttons.
 *
 * Calls `signIn('google' | 'github')` with the current page's
 * `callbackUrl` so a user mid-flow (e.g. trying to reach /perfil)
 * still lands on their intended destination after the OAuth round
 * trip. The `redirect: true` default takes over from there — the
 * NextAuth callback chain handles the rest.
 *
 * Loading state locks both buttons at once so a user can't kick off
 * two parallel OAuth handshakes by double-clicking.
 */
interface OAuthButtonsProps {
  callbackUrl?: string;
  disabled?: boolean;
}

type Provider = 'google' | 'github' | null;

export function OAuthButtons({
  callbackUrl,
  disabled,
}: OAuthButtonsProps): JSX.Element {
  const [pending, setPending] = useState<Provider>(null);

  const handleClick = (provider: Exclude<Provider, null>): void => {
    setPending(provider);
    void signIn(provider, { callbackUrl: callbackUrl ?? '/perfil' });
  };

  const anyBusy = pending !== null || Boolean(disabled);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Button
        type="button"
        variant="outline"
        size="md"
        className="w-full gap-2 border-border/80"
        onClick={() => handleClick('google')}
        loading={pending === 'google'}
        disabled={anyBusy}
      >
        <GoogleIcon />
        Google
      </Button>

      <Button
        type="button"
        variant="outline"
        size="md"
        className="w-full gap-2 border-border/80"
        onClick={() => handleClick('github')}
        loading={pending === 'github'}
        disabled={anyBusy}
      >
        <GitHubGlyph />
        GitHub
      </Button>
    </div>
  );
}

/** Google "G" multicolor logo — inlined to avoid a runtime icon dep. */
function GoogleIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.5l3.2 2.3c.9-1.7 2.5-2.8 4.3-2.8 1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 4.6 14.6 3.7 12 3.7c-3.7 0-6.9 2.1-8.4 5.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 20.3c2.6 0 4.8-.9 6.4-2.3l-3.1-2.4c-.9.6-2 1-3.3 1-2.6 0-4.8-1.7-5.6-4l-3.2 2.5c1.5 3 4.6 5.2 8.8 5.2z"
      />
      <path
        fill="#4285F4"
        d="M20.8 10.4h-8.8v3.9h5.5c-.3 1-1.2 2.4-2.5 3.3l3.1 2.4c1.9-1.8 3-4.4 3-7.6 0-.6 0-1.1-.3-2z"
      />
    </svg>
  );
}

/** GitHub octocat glyph — inlined. */
function GitHubGlyph(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.38 6.84 9.74.5.09.68-.22.68-.48v-1.7c-2.78.62-3.37-1.35-3.37-1.35-.45-1.17-1.11-1.48-1.11-1.48-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.67.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.74-.1-.26-.45-1.29.1-2.69 0 0 .84-.27 2.75 1.05.8-.23 1.65-.34 2.5-.34.85 0 1.7.11 2.5.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.4.2 2.43.1 2.69.64.71 1.03 1.62 1.03 2.74 0 3.93-2.34 4.79-4.56 5.05.36.32.68.94.68 1.9v2.81c0 .27.18.58.69.48A10.24 10.24 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
      />
    </svg>
  );
}
