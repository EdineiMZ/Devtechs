import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';
import { RedisModule } from '../../redis/redis.module';

import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [RedisModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, PermissionGuard],
  exports: [InvoicesService],
})
export class InvoicesModule {}
