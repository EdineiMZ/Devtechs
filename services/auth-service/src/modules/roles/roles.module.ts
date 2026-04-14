import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';
import { PermissionCacheService } from '../../common/rbac/permission-cache.service';

import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  controllers: [RolesController],
  providers: [RolesService, PermissionGuard, PermissionCacheService],
  exports: [RolesService, PermissionCacheService],
})
export class RolesModule {}
