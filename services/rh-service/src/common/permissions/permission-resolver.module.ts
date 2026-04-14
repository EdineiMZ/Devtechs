import { Global, Module } from '@nestjs/common';

import { PermissionResolverService } from './permission-resolver.service';

/**
 * Global so every feature module can inject `PermissionResolverService`
 * without having to wire it up locally.
 */
@Global()
@Module({
  providers: [PermissionResolverService],
  exports: [PermissionResolverService],
})
export class PermissionResolverModule {}
