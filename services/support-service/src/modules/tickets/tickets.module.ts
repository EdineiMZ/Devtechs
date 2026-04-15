import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, PermissionGuard],
  exports: [TicketsService],
})
export class TicketsModule {}
