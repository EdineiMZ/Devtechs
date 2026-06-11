import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ActivationController],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}
