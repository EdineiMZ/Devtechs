import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

import { CheckoutService } from './checkout.service';
import { CheckoutInvoiceDto } from './dto/checkout.dto';

@Controller('checkout')
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(private readonly checkout: CheckoutService) {}

  /**
   * POST /checkout/invoice/:id
   * Initiates a transparent payment for an invoice.
   * For PIX: returns QR code (string + base64 image).
   * For card: requires the MP card token from the frontend SDK.
   */
  @Post('invoice/:id')
  @HttpCode(HttpStatus.OK)
  pay(
    @Param('id') invoiceId: string,
    @Body() dto: CheckoutInvoiceDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.checkout.payInvoice(invoiceId, dto, user.id);
  }

  /**
   * POST /checkout/invoice/:id/check-payment
   * Manual trigger to pull the latest payment status from Mercado Pago.
   * Used by the PIX QR view as a fallback when the automatic webhook hasn't fired.
   */
  @Post('invoice/:id/check-payment')
  @HttpCode(HttpStatus.OK)
  async checkPayment(
    @Param('id') invoiceId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ status: string }> {
    return this.checkout.checkPaymentStatus(invoiceId, user.id);
  }

  /**
   * POST /checkout/webhook
   * Mercado Pago webhook endpoint — receives payment status updates.
   * HMAC-SHA256 signature is verified before processing.
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: RawBodyRequest<Request>): Promise<void> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    const headers = req.headers as Record<string, string | string[] | undefined>;
    const valid = await this.checkout.verifyWebhookSignature(rawBody, headers);
    if (!valid) {
      this.logger.warn('Mercado Pago webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid JSON body');
    }

    const type = String(parsed['type'] ?? '');
    const data = parsed['data'] as Record<string, unknown> | undefined;
    const mpId = String(data?.['id'] ?? '');

    // MP webhook body never contains the payment status — only the payment ID.
    // The service must fetch the real status from the MP API.
    if (type === 'payment' && mpId) {
      return this.checkout.handleWebhookPayment(mpId);
    }
    return Promise.resolve();
  }
}
