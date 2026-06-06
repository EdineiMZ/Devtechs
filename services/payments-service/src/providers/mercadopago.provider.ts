import * as crypto from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, {
  Payment,
  PreApproval,
} from 'mercadopago';

import { RedisService } from '../redis/redis.service';
import type {
  CreatePaymentInput,
  CreateSubscriptionInput,
  PaymentProvider,
  PaymentProviderResult,
  WebhookResult,
} from './payment-provider.interface';

/** Mercado Pago v2 SDK adapter. */
@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';

  private readonly logger = new Logger(MercadoPagoProvider.name);
  private readonly envAccessToken: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService, private readonly redis: RedisService) {
    // Accepts both MP_ACCESS_TOKEN (config-panel managed key) and the legacy
    // MERCADOPAGO_ACCESS_TOKEN so existing .env files keep working.
    this.envAccessToken =
      config.get<string>('MP_ACCESS_TOKEN') ??
      config.get<string>('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    this.webhookSecret =
      config.get<string>('MP_WEBHOOK_SECRET') ??
      config.get<string>('MERCADOPAGO_WEBHOOK_SECRET') ?? '';

    if (!this.envAccessToken) {
      this.logger.warn(
        'MERCADOPAGO_ACCESS_TOKEN is empty — will resolve from Redis on each request.',
      );
    }
  }

  private async resolveAccessToken(): Promise<string> {
    try {
      const keys = await this.redis.hgetall('SZDevs:config:api_keys');
      if (keys['MP_ACCESS_TOKEN']) return keys['MP_ACCESS_TOKEN'];
    } catch { /* fall through to env */ }
    return this.envAccessToken;
  }

  private getMpResources(token: string): { payment: Payment; preApproval: PreApproval } {
    const client = new MercadoPagoConfig({ accessToken: token });
    return { payment: new Payment(client), preApproval: new PreApproval(client) };
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult> {
    const token = await this.resolveAccessToken();
    if (!token) {
      this.logger.warn('No MP access token — returning stub payment');
      return {
        externalId: `stub-payment-${Date.now()}`,
        status: 'pending',
        externalUrl: undefined,
        metadata: { stub: true },
      };
    }

    const { payment } = this.getMpResources(token);

    const body: Record<string, unknown> = {
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: input.method === 'pix' ? 'pix' : input.method,
      payer: { email: input.payerEmail },
      external_reference: input.externalReference,
    };
    if (input.notificationUrl) {
      body.notification_url = input.notificationUrl;
    }

    const result = await payment.create({ body });

    const metadata: Record<string, unknown> = {};
    if (input.method === 'pix') {
      const poi = (result as unknown as Record<string, unknown>)
        .point_of_interaction as Record<string, unknown> | undefined;
      const td = poi?.transaction_data as Record<string, unknown> | undefined;
      if (td?.qr_code) {
        metadata.qr_code = td.qr_code;
      }
      if (td?.qr_code_base64) {
        metadata.qr_code_base64 = td.qr_code_base64;
      }
    }

    return {
      externalId: String(result.id ?? ''),
      status: result.status ?? 'pending',
      externalUrl: undefined,
      metadata,
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<PaymentProviderResult> {
    const token = await this.resolveAccessToken();
    if (!token) {
      this.logger.warn('No MP access token — returning stub subscription');
      return {
        externalId: `stub-sub-${Date.now()}`,
        status: 'pending',
        externalUrl: 'https://www.mercadopago.com.br/subscriptions/stub',
        metadata: { stub: true },
      };
    }

    const { preApproval } = this.getMpResources(token);

    const body: Record<string, unknown> = {
      reason: input.planName,
      auto_recurring: {
        frequency: 1,
        frequency_type: input.interval === 'yearly' ? 'years' : 'months',
        transaction_amount: input.planPrice,
        currency_id: 'BRL',
      },
      payer_email: input.payerEmail,
      external_reference: input.externalReference,
      status: 'pending',
    };
    if (input.backUrl) {
      body.back_url = input.backUrl;
    }

    const result = await preApproval.create({ body });

    return {
      externalId: String(result.id ?? ''),
      status: result.status ?? 'pending',
      externalUrl: (result as unknown as Record<string, unknown>).init_point as string | undefined,
      metadata: {},
    };
  }

  async cancelSubscription(externalId: string): Promise<void> {
    const token = await this.resolveAccessToken();
    if (!token) {
      this.logger.warn(`[stub] cancelSubscription(${externalId})`);
      return;
    }
    const { preApproval } = this.getMpResources(token);
    await preApproval.update({
      id: externalId,
      body: { status: 'cancelled' },
    });
  }

  async getPaymentStatus(
    externalId: string,
  ): Promise<{ status: string; metadata?: Record<string, unknown> }> {
    const token = await this.resolveAccessToken();
    if (!token) {
      return { status: 'pending', metadata: { stub: true } };
    }
    const { payment } = this.getMpResources(token);
    const result = await payment.get({ id: Number(externalId) });
    return {
      status: result.status ?? 'unknown',
      metadata: {},
    };
  }

  /**
   * Verifies the Mercado Pago webhook signature.
   *
   * MP header format: `ts=<timestamp>,v1=<hmac-hex>`
   * Manifest string: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
   * HMAC-SHA256 with the webhook secret, compared timing-safe.
   */
  verifyWebhookSignature(
    _rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature check');
      return true;
    }

    const sigHeader = headers['x-signature'];
    const requestId = headers['x-request-id'];
    const dataId = headers['x-data-id'];

    if (!sigHeader || !requestId) return false;

    const sigStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const reqId = Array.isArray(requestId) ? requestId[0] : requestId;
    const dId = Array.isArray(dataId) ? (dataId[0] ?? '') : (dataId ?? '');

    if (!sigStr) return false;

    // Parse ts and v1 from the signature header.
    const parts = Object.fromEntries(
      sigStr.split(',').map((part) => part.split('=')),
    ) as Record<string, string>;
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dId};request-id:${reqId};ts:${ts};`;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(manifest)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /**
   * Parses the webhook body, fetching the full resource from MP.
   */
  async parseWebhook(body: unknown): Promise<WebhookResult> {
    const parsed = body as Record<string, unknown>;
    const type = String(parsed['type'] ?? 'unknown');
    const action = String(parsed['action'] ?? '');
    const data = parsed['data'] as Record<string, unknown> | undefined;
    const externalId = String(data?.['id'] ?? '');

    const token = await this.resolveAccessToken();
    if (!token) {
      return { type: 'unknown', action, externalId, status: 'pending', metadata: { stub: true } };
    }

    const { payment } = this.getMpResources(token);

    if (type === 'payment' && externalId) {
      try {
        const result = await payment.get({ id: Number(externalId) });
        return {
          type: 'payment',
          action,
          externalId: String(result.id ?? externalId),
          status: result.status ?? 'unknown',
          metadata: {},
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to fetch payment ${externalId}: ${reason}`);
        return { type: 'payment', action, externalId, status: 'unknown' };
      }
    }

    if (type === 'subscription_preapproval' && externalId) {
      return { type: 'subscription', action, externalId, status: 'unknown' };
    }

    return { type: 'unknown', action, externalId, status: 'unknown' };
  }
}
