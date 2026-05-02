/**
 * @jest-environment jsdom
 *
 * Unit tests for the faturas surface. We stub `next/link` so the
 * components render plain anchors in jsdom, and stub
 * `next-auth/react` because the row uses no session calls but
 * its imports load.
 */

import { render, screen } from '@testing-library/react';

import { formatBRL, formatDate } from '@/components/finance/format';
import { InvoiceRow } from '@/components/finance/InvoiceRow';
import { InvoiceStatusBadge } from '@/components/finance/InvoiceStatusBadge';
import { normalizeInvoice, type RawInvoice } from '@/lib/finance-api';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
// next/navigation is pulled in transitively by some pages — provide
// a no-op shim so jsdom doesn't blow up on import.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));
// Stub `@/auth` — it pulls in NextAuth (ESM), which jest can't
// transform without extra config. The test never actually invokes
// `auth()`; only the import path needs to exist.
jest.mock('@/auth', () => ({ auth: jest.fn() }));

function makeRawInvoice(over: Partial<RawInvoice> = {}): RawInvoice {
  return {
    id: 'inv-1',
    number: '2026-0001',
    client: { id: 'u-1', name: 'Maria', email: 'maria@cliente.com' },
    subtotal: 1000,
    tax: 100,
    total: 1100,
    status: 'SENT',
    issuedAt: new Date('2026-04-01').toISOString(),
    dueDate: new Date('2026-04-30').toISOString(),
    paidAt: null,
    notes: null,
    items: [
      {
        id: 'it-1',
        description: 'Mensalidade plano Pro',
        quantity: 1,
        unitPrice: 1000,
        total: 1000,
      },
    ],
    createdAt: new Date('2026-04-01').toISOString(),
    updatedAt: new Date('2026-04-01').toISOString(),
    ...over,
  };
}

describe('formatBRL', () => {
  it('formats numbers as BRL currency with comma decimal', () => {
    expect(formatBRL(1500)).toMatch(/^R\$.*1\.500,00$/);
    expect(formatBRL(0)).toMatch(/^R\$.*0,00$/);
    expect(formatBRL(99.9)).toMatch(/^R\$.*99,90$/);
  });
});

describe('formatDate', () => {
  it('formats ISO date as DD/MM/YYYY', () => {
    // Pin to noon UTC so any tz offset (-12..+14) lands on the
    // same calendar day in pt-BR — avoids tz-flake test failures.
    expect(formatDate('2026-04-15T12:00:00Z')).toMatch(/15\/04\/2026/);
  });
  it('returns - for null/empty input', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('not-a-date')).toBe('-');
  });
});

describe('InvoiceStatusBadge', () => {
  it('renders PAID label for PAID status', () => {
    render(<InvoiceStatusBadge status="PAID" />);
    expect(screen.getByText(/paga/i)).toBeInTheDocument();
  });
  it('renders OVERDUE label for OVERDUE status', () => {
    render(<InvoiceStatusBadge status="OVERDUE" />);
    expect(screen.getByText(/vencida/i)).toBeInTheDocument();
  });
});

describe('normalizeInvoice', () => {
  it('maps SENT to PENDING when not yet due', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const inv = normalizeInvoice(makeRawInvoice({ status: 'SENT', dueDate: future }));
    expect(inv.status).toBe('PENDING');
    expect(inv.amount).toBe(1100);
  });
  it('maps DRAFT past due date to OVERDUE', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const inv = normalizeInvoice(
      makeRawInvoice({ status: 'DRAFT', dueDate: past }),
    );
    expect(inv.status).toBe('OVERDUE');
  });
  it('maps CANCELLED to CANCELED (legacy spelling)', () => {
    const inv = normalizeInvoice(makeRawInvoice({ status: 'CANCELLED' }));
    expect(inv.status).toBe('CANCELED');
  });
  it('maps PAID through unchanged', () => {
    const inv = normalizeInvoice(
      makeRawInvoice({
        status: 'PAID',
        paidAt: new Date('2026-04-20').toISOString(),
      }),
    );
    expect(inv.status).toBe('PAID');
    expect(inv.paidAt).toBeTruthy();
  });
});

describe('InvoiceRow', () => {
  const invoice = normalizeInvoice(makeRawInvoice());

  it('renders the invoice number, description, due date and amount', () => {
    render(
      <table>
        <tbody>
          <InvoiceRow invoice={invoice} accessToken="tk" />
        </tbody>
      </table>,
    );
    expect(screen.getByText('2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/Mensalidade plano Pro/)).toBeInTheDocument();
    // BRL formatting with non-breaking space around R$.
    expect(screen.getByText(/R\$.*1\.100,00/)).toBeInTheDocument();
  });

  it('shows the "Pagar" button when status is PENDING', () => {
    render(
      <table>
        <tbody>
          <InvoiceRow invoice={invoice} accessToken="tk" />
        </tbody>
      </table>,
    );
    expect(screen.getByRole('button', { name: /pagar/i })).toBeInTheDocument();
  });

  it('hides the "Pagar" button when status is PAID', () => {
    const paid = normalizeInvoice(
      makeRawInvoice({
        status: 'PAID',
        paidAt: new Date('2026-04-20').toISOString(),
      }),
    );
    render(
      <table>
        <tbody>
          <InvoiceRow invoice={paid} accessToken="tk" />
        </tbody>
      </table>,
    );
    expect(screen.queryByRole('button', { name: /pagar/i })).toBeNull();
  });
});
