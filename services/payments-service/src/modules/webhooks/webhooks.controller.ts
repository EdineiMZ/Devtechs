import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { PAYMENT_PROVIDER, PaymentProvider } from '../../providers/payment-provider.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Mercado Pago webhook endpoint. Signature-verified, @Public. */
  @Post('mercadopago')
  @Public()
  @HttpCode(HttpStatus.OK)
  async mercadopago(@Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    const headers = req.headers as Record<string, string | string[] | undefined>;
    const valid = this.provider.verifyWebhookSignature(rawBody, headers);
    if (!valid) {
      this.logger.warn('Mercado Pago webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    const event = await this.provider.parseWebhook(body);
    this.logger.log(`Webhook event: type=${event.type} action=${event.action} id=${event.externalId}`);

    if (event.type === 'payment' && event.action === 'payment.updated' && event.status === 'approved') {
      await this.subscriptions.handleWebhookPaymentConfirmed(event.externalId);
    }

    return { received: true };
  }
}
