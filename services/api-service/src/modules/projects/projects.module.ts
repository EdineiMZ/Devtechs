import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ApiKeyGuard, RequireApiPermissionGuard],
})
export class ProjectsModule {}
