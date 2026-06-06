import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, ApiKeyGuard, RequireApiPermissionGuard],
})
export class FinanceModule {}
