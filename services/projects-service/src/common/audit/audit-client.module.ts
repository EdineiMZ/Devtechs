import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditClientService } from './audit-client.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditClientService],
  exports: [AuditClientService],
})
export class AuditClientModule {}
