/**
 * Adapter interface — every payment gateway implements this.
 * The service layer depends on the interface, never on a
 * concrete provider, so swapping Mercado Pago for Stripe is
 * a one-line DI change.
 */
export const PAYMENT_PROVIDER = Symbol.for('PaymentProvider');

export interface CreateSubscriptionInput {
  planName: string;
  planPrice: number;
  interval: 'monthly' | 'yearly';
  payerEmail: string;
  externalReference: string;
  backUrl?: string;
}

export interface CreatePaymentInput {
  amount: number;
  description: string;
  payerEmail: string;
  method: 'pix' | 'boleto' | 'credit_card' | 'debit_card';
  externalReference: string;
  notificationUrl?: string;
}

export interface PaymentProviderResult {
  externalId: string;
  status: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookResult {
  type: 'payment' | 'subscription' | 'unknown';
  action: string;
  externalId: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  createSubscription(input: CreateSubscriptionInput): Promise<PaymentProviderResult>;
  cancelSubscription(externalId: string): Promise<void>;
  createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult>;
  getPaymentStatus(externalId: string): Promise<{ status: string; metadata?: Record<string, unknown> }>;
  verifyWebhookSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhook(body: unknown): Promise<WebhookResult>;
}
