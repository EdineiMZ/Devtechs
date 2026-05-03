import { Module } from '@nestjs/common';

import { AuditClientModule } from '../../common/audit/audit-client.module';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuditClientModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PermissionGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
