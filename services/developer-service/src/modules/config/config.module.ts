import { Module } from '@nestjs/common';

import { DeveloperConfigController } from './config.controller';
import { DeveloperConfigService } from './config.service';

@Module({
  controllers: [DeveloperConfigController],
  providers: [DeveloperConfigService],
  exports: [DeveloperConfigService],
})
export class DeveloperConfigModule {}
