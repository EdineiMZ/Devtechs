import { Injectable } from '@nestjs/common';

import type {
  CreatePaymentInput,
  CreateSubscriptionInput,
  PaymentProvider,
  PaymentProviderResult,
  WebhookResult,
} from './payment-provider.interface';

// TODO: install the `stripe` npm package and implement each method.
/** Stripe adapter — stub only. All methods throw until implemented. */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  // TODO: inject ConfigService and initialise the Stripe client.
  createSubscription(_input: CreateSubscriptionInput): Promise<PaymentProviderResult> {
    throw new Error('Stripe provider not yet implemented');
  }

  cancelSubscription(_externalId: string): Promise<void> {
    throw new Error('Stripe provider not yet implemented');
  }

  createPayment(_input: CreatePaymentInput): Promise<PaymentProviderResult> {
    throw new Error('Stripe provider not yet implemented');
  }

  getPaymentStatus(
    _externalId: string,
  ): Promise<{ status: string; metadata?: Record<string, unknown> }> {
    throw new Error('Stripe provider not yet implemented');
  }

  verifyWebhookSignature(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): boolean {
    // TODO: use stripe.webhooks.constructEvent for signature verification.
    throw new Error('Stripe provider not yet implemented');
  }

  parseWebhook(_body: unknown): Promise<WebhookResult> {
    // TODO: map Stripe event types to WebhookResult.
    throw new Error('Stripe provider not yet implemented');
  }
}
