import { Module } from '@nestjs/common';

import { PermissionResolverModule } from '../../common/permissions/permission-resolver.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { DepartmentsController } from './departments.controller';

@Module({
  imports: [PrismaModule, PermissionResolverModule],
  controllers: [DepartmentsController],
})
export class DepartmentsModule {}
