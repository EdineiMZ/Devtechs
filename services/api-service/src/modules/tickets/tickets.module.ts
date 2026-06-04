import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, ApiKeyGuard, RequireApiPermissionGuard],
})
export class TicketsModule {}
