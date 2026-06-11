import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { MpWebhookDto } from './dto/mp-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('mercadopago')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive MercadoPago payment notifications' })
  handle(
    @Body() dto: MpWebhookDto,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<{ ok: boolean; reason?: string }> {
    return this.webhooks.handle(dto, signature, requestId);
  }
}
