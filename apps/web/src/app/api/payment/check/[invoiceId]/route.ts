import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getFinanceServiceUrl } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payment/check/:invoiceId
 * Manually triggers a Mercado Pago status pull for a PIX payment.
 * Used as a fallback when the automatic webhook hasn't fired yet.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { invoiceId } = await params;

  try {
    const res = await fetch(
      `${getFinanceServiceUrl()}/checkout/invoice/${encodeURIComponent(invoiceId)}/check-payment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Not found' }, { status: res.status });
    }
    const data = (await res.json()) as { status: string };
    return NextResponse.json({ status: data.status });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
