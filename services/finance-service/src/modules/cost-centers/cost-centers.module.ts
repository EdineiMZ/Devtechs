import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';

@Module({
  controllers: [CostCentersController],
  providers: [CostCentersService, PermissionGuard],
  exports: [CostCentersService],
})
export class CostCentersModule {}
