import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { WorkSchedulesController } from './work-schedules.controller';
import { WorkSchedulesService } from './work-schedules.service';

@Module({
  controllers: [WorkSchedulesController],
  providers: [WorkSchedulesService, PermissionGuard],
  exports: [WorkSchedulesService],
})
export class WorkSchedulesModule {}
