import { Global, Module } from '@nestjs/common';

import { CsvExportService } from '../../common/csv/csv-export.service';
import { RolesGuard } from '../../common/guards/roles.guard';

import { AuditQueryController } from './audit-query.controller';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController, AuditQueryController],
  providers: [AuditService, AuditInterceptor, RolesGuard, CsvExportService],
  exports: [AuditService, AuditInterceptor, CsvExportService],
})
export class AuditModule {}
