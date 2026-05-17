import * as crypto from 'crypto';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, { Payment } from 'mercadopago';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { CheckoutInvoiceDto } from './dto/checkout.dto';

const API_KEYS_REDIS_KEY = 'SZDevs:config:api_keys';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly envAccessToken: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.envAccessToken = config.get<string>('MP_ACCESS_TOKEN') ?? '';
    this.webhookSecret =
      config.get<string>('MP_WEBHOOK_SECRET') ??
      config.get<string>('MERCADOPAGO_WEBHOOK_SECRET') ?? '';
    if (!this.webhookSecret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET not set — webhook signature verification will be skipped (dev mode only)',
      );
    }
  }

  /**
   * Verifies the Mercado Pago HMAC-SHA256 webhook signature.
   * Resolves the secret from Redis first (falls back to env var).
   * Returns true when the signature matches or when no secret is configured (dev mode).
   */
  async verifyWebhookSignature(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<boolean> {
    const secret = await this.resolveWebhookSecret();
    if (!secret) {
      this.logger.warn('Skipping webhook signature check — MP_WEBHOOK_SECRET not configured in env or Redis');
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

    const parts = Object.fromEntries(
      sigStr.split(',').map((part) => {
        const idx = part.indexOf('=');
        return idx === -1 ? [part, ''] : [part.slice(0, idx), part.slice(idx + 1)];
      }),
    ) as Record<string, string>;
    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    const manifest = `id:${dId};request-id:${reqId};ts:${ts};`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private async resolveWebhookSecret(): Promise<string> {
    try {
      const keys = await this.redis.hgetall(API_KEYS_REDIS_KEY);
      if (keys['MP_WEBHOOK_SECRET']) return keys['MP_WEBHOOK_SECRET'];
    } catch {
      // Redis unavailable — fall through to env
    }
    return this.webhookSecret;
  }

  private async resolveAccessToken(): Promise<string> {
    try {
      const keys = await this.redis.hgetall(API_KEYS_REDIS_KEY);
      if (keys['MP_ACCESS_TOKEN']) return keys['MP_ACCESS_TOKEN'];
    } catch {
      // Redis unavailable — fall through to env
    }
    return this.envAccessToken;
  }

  private buildPayment(accessToken: string): Payment {
    return new Payment(new MercadoPagoConfig({ accessToken }));
  }

  async payInvoice(
    invoiceId: string,
    dto: CheckoutInvoiceDto,
    requesterId: string,
  ): Promise<unknown> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.clientId !== requesterId) {
      throw new BadRequestException('You can only pay your own invoices');
    }
    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is cancelled and cannot be paid');
    }

    const amount = Number(invoice.total);
    const payerEmail = dto.payerEmail ?? invoice.client.email;
    const description = `Fatura SZDevs ${invoice.number}`;

    const accessToken = await this.resolveAccessToken();
    const devMode = !accessToken;

    if (devMode) {
      this.logger.warn('MP_ACCESS_TOKEN not set — running in stub mode');
      // Stub response for development
      const stubResult = {
        paymentId: `stub-${Date.now()}`,
        status: dto.method === 'pix' ? 'pending' : 'approved',
        method: dto.method,
        pixQrCode: dto.method === 'pix' ? '00020126580014br.gov.bcb.pix' : null,
        pixQrCodeBase64: dto.method === 'pix' ? 'stub-base64-qr' : null,
      };
      // Auto-update invoice status to PAID in stub mode for card
      if (dto.method === 'card') {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'PAID', paidAt: new Date() },
        });
        void this.notifyPaymentReceived(invoice.clientId, invoice.number, amount);
      }
      return stubResult;
    }

    const payment = this.buildPayment(accessToken);

    const body: Record<string, unknown> = {
      transaction_amount: amount,
      description,
      payer: { email: payerEmail },
      external_reference: invoiceId,
    };

    if (dto.method === 'pix') {
      body.payment_method_id = 'pix';
    } else if (dto.method === 'card' && dto.card) {
      const requestedInstallments = Number(dto.card.installments);

      // Validate against active payment conditions configured in the system.
      const condition = await this.prisma.paymentCondition.findFirst({
        where: { installments: requestedInstallments, active: true },
      });
      if (!condition) {
        const active = await this.prisma.paymentCondition.findMany({
          where: { active: true },
          orderBy: { installments: 'asc' },
          select: { installments: true },
        });
        const allowed = active.map((c) => c.installments).join(', ');
        throw new BadRequestException(
          `Número de parcelas inválido. Opções disponíveis: ${allowed || 'nenhuma configurada'}`,
        );
      }

      body.token = dto.card.token;
      body.installments = requestedInstallments;
      body.payment_method_id = dto.card.paymentMethodId;
      body.issuer_id = dto.card.issuerId;
    } else {
      throw new BadRequestException('Card details required for card payment');
    }

    let result: Awaited<ReturnType<Payment['create']>>;
    try {
      result = await payment.create({ body });
    } catch (err: unknown) {
      const mpErr = err as Record<string, unknown>;
      const mpMsg =
        typeof mpErr?.message === 'string' ? mpErr.message : 'Falha ao processar pagamento';
      const mpStatus =
        typeof mpErr?.status === 'number' && mpErr.status >= 400 && mpErr.status < 600
          ? mpErr.status
          : 502;
      if (mpStatus < 500) {
        throw new BadRequestException(`Pagamento recusado: ${mpMsg}`);
      }
      this.logger.error(`MercadoPago error: ${JSON.stringify(err)}`);
      throw new InternalServerErrorException(`Gateway de pagamento indisponível: ${mpMsg}`);
    }
    const externalId = String(result.id ?? '');
    const status = result.status ?? 'pending';

    // Persist payment record
    const paymentMethod =
      dto.method === 'pix' ? 'PIX' : 'CREDIT_CARD';
    const paymentStatus =
      status === 'approved' ? 'PAID' : status === 'rejected' ? 'FAILED' : 'PENDING';

    await this.prisma.payment.create({
      data: {
        userId: requesterId,
        invoiceId,
        amount,
        currency: 'BRL',
        method: paymentMethod as 'PIX' | 'CREDIT_CARD',
        externalId,
        status: paymentStatus as 'PENDING' | 'PAID' | 'FAILED',
        metadata: body as object,
      },
    });

    const statusDetail = (result as unknown as Record<string, unknown>)
      .status_detail as string | null | undefined;

    const metadata: Record<string, unknown> = {
      status,
      statusDetail: statusDetail ?? null,
    };

    if (dto.method === 'pix') {
      const poi = (result as unknown as Record<string, unknown>)
        .point_of_interaction as Record<string, unknown> | undefined;
      const td = poi?.transaction_data as Record<string, unknown> | undefined;
      if (td) {
        metadata.pixQrCode = td.qr_code ?? null;
        metadata.pixQrCodeBase64 = td.qr_code_base64 ?? null;
      }
    }

    // Rejected payments: throw so the controller returns 422 and the
    // frontend can show the real error without checking body.status.
    if (status === 'rejected') {
      throw new BadRequestException({
        message: 'Pagamento recusado pela operadora.',
        statusDetail: statusDetail ?? 'cc_rejected_other_reason',
        paymentId: externalId,
      });
    }

    // If already approved, mark invoice as paid
    if (status === 'approved') {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });
      void this.notifyPaymentReceived(invoice.clientId, invoice.number, amount);
    }

    return {
      paymentId: externalId,
      method: dto.method,
      ...metadata,
    };
  }

  /**
   * Called by the webhook handler when MP notifies a payment event.
   * MP webhooks do NOT carry the payment status in the body — we must
   * fetch it from the MP API using the payment ID.
   */
  async handleWebhookPayment(mpPaymentId: string): Promise<void> {
    const accessToken = await this.resolveAccessToken();
    if (!accessToken) {
      this.logger.warn(`handleWebhookPayment: no MP access token, skipping ${mpPaymentId}`);
      return;
    }

    let mpStatus: string;
    try {
      const mpPayment = this.buildPayment(accessToken);
      const result = await mpPayment.get({ id: Number(mpPaymentId) });
      mpStatus = result.status ?? 'unknown';
      this.logger.log(`MP payment ${mpPaymentId} status from API: ${mpStatus}`);
    } catch (err) {
      this.logger.error(
        `handleWebhookPayment: failed to fetch payment ${mpPaymentId} from MP API: ${String(err)}`,
      );
      return;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { externalId: mpPaymentId },
    });
    if (!payment) {
      this.logger.warn(`handleWebhookPayment: no local payment found for externalId ${mpPaymentId}`);
      return;
    }

    const mappedStatus =
      mpStatus === 'approved' ? 'PAID' : mpStatus === 'rejected' ? 'FAILED' : 'PENDING';
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus as 'PAID' | 'FAILED' | 'PENDING',
        paidAt: mpStatus === 'approved' ? new Date() : undefined,
      },
    });

    if (mpStatus === 'approved' && payment.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { id: true, clientId: true, number: true, total: true, status: true },
      });
      if (invoice && invoice.status !== 'PAID') {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        void this.notifyPaymentReceived(
          invoice.clientId,
          invoice.number,
          Number(invoice.total),
        );
      }
    }
  }

  private async notifyPaymentReceived(
    userId: string,
    invoiceNumber: string,
    amount: number,
  ): Promise<void> {
    const brl = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);

    const envelope = (payload: unknown) =>
      JSON.stringify({ publishedAt: new Date().toISOString(), payload });

    await this.redis.publish(
      'notifications:inapp',
      envelope({
        userId,
        title: 'Pagamento confirmado',
        body: `Seu pagamento de ${brl} referente à fatura ${invoiceNumber} foi confirmado.`,
        type: 'invoice.paid',
        link: `/perfil/faturas`,
      }),
    );
  }
}
