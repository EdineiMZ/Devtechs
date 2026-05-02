import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, { Payment } from 'mercadopago';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { CheckoutInvoiceDto } from './dto/checkout.dto';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly payment: Payment;
  private readonly devMode: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    const accessToken = config.get<string>('MP_ACCESS_TOKEN') ?? '';
    this.devMode = !accessToken;
    if (this.devMode) {
      this.logger.warn('MP_ACCESS_TOKEN not set — running in stub mode');
    }
    const mpClient = new MercadoPagoConfig({
      accessToken: accessToken || 'TEST-stub',
    });
    this.payment = new Payment(mpClient);
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
    const description = `Fatura DevTechs ${invoice.number}`;

    if (this.devMode) {
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

    const body: Record<string, unknown> = {
      transaction_amount: amount,
      description,
      payer: { email: payerEmail },
      external_reference: invoiceId,
    };

    if (dto.method === 'pix') {
      body.payment_method_id = 'pix';
    } else if (dto.method === 'card' && dto.card) {
      body.token = dto.card.token;
      body.installments = Number(dto.card.installments);
      body.payment_method_id = dto.card.paymentMethodId;
      body.issuer_id = dto.card.issuerId;
    } else {
      throw new BadRequestException('Card details required for card payment');
    }

    const result = await this.payment.create({ body });
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

  /** Called by the webhook handler when MP confirms payment. */
  async handleWebhookPayment(
    mpPaymentId: string,
    status: string,
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalId: mpPaymentId },
    });
    if (!payment) return;

    const mappedStatus =
      status === 'approved' ? 'PAID' : status === 'rejected' ? 'FAILED' : 'PENDING';
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: mappedStatus as 'PAID' | 'FAILED' | 'PENDING' },
    });

    if (status === 'approved' && payment.invoiceId) {
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
        link: `/financeiro/faturas`,
      }),
    );
  }
}
