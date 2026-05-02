import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { PaymentConditionsController } from './payment-conditions.controller';
import { PaymentConditionsService } from './payment-conditions.service';

@Module({
  controllers: [PaymentConditionsController],
  providers: [PaymentConditionsService, PermissionGuard],
  exports: [PaymentConditionsService],
})
export class PaymentConditionsModule {}
