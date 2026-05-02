import { Module } from '@nestjs/common';

import { PermissionResolverModule } from '../../common/permissions/permission-resolver.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PositionsController } from './positions.controller';

@Module({
  imports: [PrismaModule, PermissionResolverModule],
  controllers: [PositionsController],
})
export class PositionsModule {}
