import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, PermissionGuard],
  exports: [EmployeesService],
})
export class EmployeesModule {}
