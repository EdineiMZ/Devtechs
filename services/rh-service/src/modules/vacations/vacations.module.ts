import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { VacationsController } from './vacations.controller';
import { VacationsService } from './vacations.service';

@Module({
  controllers: [VacationsController],
  providers: [VacationsService, PermissionGuard],
  exports: [VacationsService],
})
export class VacationsModule {}
