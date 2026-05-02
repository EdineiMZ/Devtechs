import { Module } from '@nestjs/common';

import { AuditClientModule } from '../../common/audit/audit-client.module';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  imports: [AuditClientModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, PermissionGuard],
  exports: [EmployeesService],
})
export class EmployeesModule {}
