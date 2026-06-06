import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type {
  CreatePaymentInput,
  CreateSubscriptionInput,
  PaymentProvider,
  PaymentProviderResult,
  WebhookResult,
} from './payment-provider.interface';

/** Stripe adapter — stub only. Returns HTTP 503 until fully implemented. */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  createSubscription(_input: CreateSubscriptionInput): Promise<PaymentProviderResult> {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }

  cancelSubscription(_externalId: string): Promise<void> {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }

  createPayment(_input: CreatePaymentInput): Promise<PaymentProviderResult> {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }

  getPaymentStatus(
    _externalId: string,
  ): Promise<{ status: string; metadata?: Record<string, unknown> }> {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }

  verifyWebhookSignature(
    _rawBody: Buffer,
    _headers: Record<string, string | string[] | undefined>,
  ): boolean {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }

  parseWebhook(_body: unknown): Promise<WebhookResult> {
    throw new ServiceUnavailableException('Stripe integration is not yet available');
  }
}
