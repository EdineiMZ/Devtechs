import { Global, Module } from '@nestjs/common';

import { RolesGuard } from '../../common/guards/roles.guard';

import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor, RolesGuard],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
