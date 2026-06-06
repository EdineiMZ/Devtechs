import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getFinanceServiceUrl } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payment/status/:invoiceId
 * Polls the finance-service for the invoice payment status.
 * Used by pay-button's PIX flow to detect when a payment is confirmed.
 */
export async function GET(
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
      `${getFinanceServiceUrl()}/invoices/${encodeURIComponent(invoiceId)}`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
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
