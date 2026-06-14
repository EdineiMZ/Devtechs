import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../prisma/prisma.module';
import { ActivationModule } from '../../activation/activation.module';
import { AgrivorAdminController } from './agrivor-admin.controller';
import { AgrivorAdminService } from './agrivor-admin.service';

@Module({
  imports: [PrismaModule, ActivationModule],
  controllers: [AgrivorAdminController],
  providers: [AgrivorAdminService],
})
export class AgrivorAdminModule {}
