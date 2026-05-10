import { NextResponse } from 'next/server';

/**
 * Returns runtime payment configuration that cannot be baked into the
 * client bundle (e.g. because the key changes without a full image
 * rebuild). The MP public key is not secret; it is used by the browser
 * to tokenise card data directly with Mercado Pago.
 *
 * Reads, in order of preference:
 *   1. NEXT_PUBLIC_MP_PUBLIC_KEY (set in .env / docker-compose)
 *   2. MP_PUBLIC_KEY (server-side only, set the same way)
 * Returns an empty string when neither is set — the client falls back
 * to the sandbox test key defined in pay-button.tsx.
 */
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  const key =
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() ||
    process.env.MP_PUBLIC_KEY?.trim() ||
    '';

  const isProbablyPlaceholder =
    !key || key === 'PLACEHOLDER' || key.toLowerCase() === 'placeholder';

  return NextResponse.json({ mpPublicKey: isProbablyPlaceholder ? '' : key });
}
