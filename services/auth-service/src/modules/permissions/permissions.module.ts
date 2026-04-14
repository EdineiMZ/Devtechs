import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { PermissionCacheService } from '../../common/rbac/permission-cache.service';

import { InternalPermissionsController } from './internal-permissions.controller';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [PermissionsController, InternalPermissionsController],
  providers: [
    PermissionsService,
    PermissionGuard,
    InternalSecretGuard,
    PermissionCacheService,
  ],
  exports: [PermissionsService],
})
export class PermissionsModule {}
