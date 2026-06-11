import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ActivationModule } from '../activation/activation.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [PrismaModule, ActivationModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
