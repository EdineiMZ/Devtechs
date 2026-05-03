import { Module } from '@nestjs/common';

import { AuditClientModule } from '../../common/audit/audit-client.module';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [AuditClientModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, PermissionGuard],
  exports: [TransactionsService],
})
export class TransactionsModule {}
