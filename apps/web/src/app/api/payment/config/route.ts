import { NextResponse } from 'next/server';

import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const API_KEYS_REDIS_KEY = 'SZDevs:config:api_keys';

/**
 * Returns runtime payment configuration that cannot be baked into the
 * client bundle. The MP public key is not secret; browsers use it to
 * tokenise card data directly with Mercado Pago.
 *
 * Resolution order:
 *   1. MP_PUBLIC_KEY env var (server-side only)
 *   2. NEXT_PUBLIC_MP_PUBLIC_KEY env var (also visible to client bundle)
 *   3. Redis hash SZDevs:config:api_keys → MP_PUBLIC_KEY
 *
 * Returns empty string when none found — client falls back to the
 * sandbox test key defined in pay-button.tsx.
 */
export async function GET(): Promise<NextResponse> {
  const envKey =
    process.env.MP_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() ||
    '';

  const isPlaceholder =
    !envKey || envKey === 'PLACEHOLDER' || envKey.toLowerCase() === 'placeholder';

  if (!isPlaceholder) {
    return NextResponse.json({ mpPublicKey: envKey });
  }

  try {
    const redis = getRedisClient();
    const key = await redis.hget(API_KEYS_REDIS_KEY, 'MP_PUBLIC_KEY');
    if (key) {
      return NextResponse.json({ mpPublicKey: key });
    }
  } catch {
    // Redis unavailable — fall through to empty
  }

  return NextResponse.json({ mpPublicKey: '' });
}
