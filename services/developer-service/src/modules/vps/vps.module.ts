import { Module } from '@nestjs/common';

import { HostingerApiService } from './hostinger-api.service';
import { VpsBillingScheduler } from './vps-billing.scheduler';
import { VpsBillingService } from './vps-billing.service';
import { VpsController } from './vps.controller';
import { VpsService } from './vps.service';

@Module({
  controllers: [VpsController],
  providers: [VpsService, HostingerApiService, VpsBillingService, VpsBillingScheduler],
  exports: [VpsService],
})
export class VpsModule {}
