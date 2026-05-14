import { NextResponse } from 'next/server';

import { getFinanceServiceUrl } from '@/lib/finance-api';

export const dynamic = 'force-dynamic';

/**
 * Proxies active payment conditions from the finance-service to the browser.
 * Allows the client-side pay-button to fetch installment options configured
 * in the admin without exposing internal service URLs to the browser.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const url = `${getFinanceServiceUrl()}/payment-conditions?active=true`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const data = await res.json() as unknown;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
