import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';

@Module({
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService, PermissionGuard],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}
