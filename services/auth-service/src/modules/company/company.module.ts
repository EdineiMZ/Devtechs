import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { CompanySettingsController } from './company-settings.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CompanySettingsController],
})
export class CompanyModule {}
