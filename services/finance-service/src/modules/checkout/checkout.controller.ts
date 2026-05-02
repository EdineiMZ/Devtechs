import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

import { CheckoutService } from './checkout.service';
import { CheckoutInvoiceDto } from './dto/checkout.dto';

@Controller('checkout')
export class CheckoutController {
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
   * POST /checkout/webhook
   * Mercado Pago webhook endpoint — receives payment status updates.
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  webhook(@Body() body: unknown): Promise<void> {
    const parsed = body as Record<string, unknown>;
    const type = String(parsed['type'] ?? '');
    const data = parsed['data'] as Record<string, unknown> | undefined;
    const mpId = String(data?.['id'] ?? '');
    const action = String(parsed['action'] ?? '');

    if (type === 'payment' && mpId) {
      // Map MP action to status
      const status =
        action === 'payment.updated' || action === 'payment.created'
          ? (parsed['status'] as string | undefined) ?? 'pending'
          : 'pending';
      return this.checkout.handleWebhookPayment(mpId, status);
    }
    return Promise.resolve();
  }
}
