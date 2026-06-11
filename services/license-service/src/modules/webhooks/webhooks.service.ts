import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { ActivationService } from '../activation/activation.service';
import type { MpWebhookDto } from './dto/mp-webhook.dto';

const MP_API_BASE = 'https://api.mercadopago.com';
const DEFAULT_VALIDITY_DAYS = 35;
const DEFAULT_MODULES = ['RURAL_PRO'];

interface MpPayment {
  id: number;
  status: string;
  external_reference: string | null;
  subscription_id: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: ActivationService,
    private readonly config: ConfigService,
  ) {}

  validateHmac(
    signature: string | undefined,
    requestId: string | undefined,
    dataId: string,
    ts: string,
  ): void {
    const secret = this.config.get<string>('MP_HMAC_SECRET');
    if (!secret) {
      this.logger.warn('MP_HMAC_SECRET not set — HMAC validation skipped');
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing x-signature header');
    }

    const parts = Object.fromEntries(
      signature.split(',').map((p) => {
        const idx = p.indexOf('=');
        return [p.slice(0, idx), p.slice(idx + 1)];
      }),
    ) as Record<string, string>;

    const receivedTs = parts['ts'] ?? ts;
    const receivedV1 = parts['v1'];

    if (!receivedV1) {
      throw new UnauthorizedException('Malformed x-signature header');
    }

    const message = [
      `id:${dataId}`,
      requestId ? `request-id:${requestId}` : null,
      `ts:${receivedTs}`,
    ]
      .filter(Boolean)
      .join(';') + ';';

    const expected = createHmac('sha256', secret).update(message).digest('hex');

    try {
      if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(receivedV1, 'hex'))) {
        throw new UnauthorizedException('Invalid MP HMAC signature');
      }
    } catch {
      throw new UnauthorizedException('Invalid MP HMAC signature');
    }
  }

  async handle(
    dto: MpWebhookDto,
    signature: string | undefined,
    requestId: string | undefined,
  ): Promise<{ ok: boolean; reason?: string }> {
    const dataId = String(dto.data.id);

    this.validateHmac(signature, requestId, dataId, '');

    if (dto.type !== 'payment' && !dto.action.startsWith('payment.')) {
      this.logger.log(`Skipping non-payment notification action=${dto.action}`);
      return { ok: true, reason: 'non-payment notification skipped' };
    }

    // Idempotency check
    const existing = await this.prisma.processedWebhook.findUnique({
      where: { mpPaymentId: dataId },
    });
    if (existing) {
      this.logger.log(`Duplicate webhook mpPaymentId=${dataId} — skipped`);
      return { ok: true, reason: 'duplicate' };
    }

    const payment = await this.fetchPayment(dataId);
    if (!payment) {
      throw new BadRequestException(`Could not fetch MP payment id=${dataId}`);
    }

    const customerId = payment.external_reference;
    if (!customerId) {
      this.logger.warn(`Payment ${dataId} has no external_reference — skipping`);
      await this.recordWebhook(dataId, null, dto.action, payment.status, { skipped: 'no_external_reference' });
      return { ok: true, reason: 'no_external_reference' };
    }

    let result: Record<string, unknown> = {};

    if (payment.status === 'approved') {
      result = await this.handleApproved(dataId, customerId, payment);
    } else if (payment.status === 'cancelled') {
      result = await this.handleCancelled(customerId);
    } else {
      this.logger.log(`Payment ${dataId} status=${payment.status} — no action`);
      result = { skipped: `status=${payment.status}` };
    }

    await this.recordWebhook(dataId, customerId, dto.action, payment.status, result);
    return { ok: true };
  }

  private async handleApproved(
    paymentId: string,
    customerId: string,
    payment: MpPayment,
  ): Promise<Record<string, unknown>> {
    const modules = await this.resolveModules(customerId, payment);

    const issued = await this.activation.issueKey({
      customerId,
      modules,
      validityDays: DEFAULT_VALIDITY_DAYS,
      issuedBy: 'webhook:mercadopago',
    });

    this.logger.log(
      JSON.stringify({
        event: 'mp_renewal_issued',
        mpPaymentId: paymentId,
        customerId,
        modules,
        novaExpiresAt: issued.expiresAt.toISOString(),
      }),
    );

    return {
      keyId: issued.keyId,
      novaExpiresAt: issued.expiresAt.toISOString(),
      modules,
    };
  }

  private async handleCancelled(customerId: string): Promise<Record<string, unknown>> {
    this.logger.log(
      JSON.stringify({
        event: 'mp_cancelled',
        customerId,
        note: 'Key left to expire naturally — no immediate revocation',
      }),
    );
    return { note: 'key_will_expire_naturally', customerId };
  }

  private async resolveModules(customerId: string, payment: MpPayment): Promise<string[]> {
    if (payment.subscription_id) {
      const sub = await this.prisma.subscription.findFirst({
        where: { externalId: payment.subscription_id },
        include: { plan: true },
      });
      if (sub?.plan.features?.length) {
        return sub.plan.features;
      }
    }

    const latest = await this.prisma.activationKey.findFirst({
      where: { customerId, revokedAt: null },
      orderBy: { issuedAt: 'desc' },
    });
    if (latest?.modules?.length) {
      return latest.modules;
    }

    return DEFAULT_MODULES;
  }

  private async fetchPayment(paymentId: string): Promise<MpPayment | null> {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      this.logger.error('MP_ACCESS_TOKEN not set — cannot fetch payment');
      return null;
    }

    try {
      const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.error(`MP API returned ${res.status} for payment ${paymentId}`);
        return null;
      }
      return (await res.json()) as MpPayment;
    } catch (err) {
      this.logger.error(`Failed to fetch payment ${paymentId}: ${String(err)}`);
      return null;
    }
  }

  private async recordWebhook(
    mpPaymentId: string,
    customerId: string | null,
    action: string,
    mpStatus: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.processedWebhook.create({
        data: { mpPaymentId, customerId, action, mpStatus, result: result as never },
      });
    } catch {
      // Unique constraint means a concurrent request already recorded it — safe to ignore
      this.logger.warn(`processedWebhook insert conflict for ${mpPaymentId}`);
    }
  }
}
