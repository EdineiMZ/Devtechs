import { Module } from '@nestjs/common';

import { AuditClientModule } from '../../common/audit/audit-client.module';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuditClientModule],
  controllers: [TasksController],
  providers: [TasksService, PermissionGuard],
  exports: [TasksService],
})
export class TasksModule {}
