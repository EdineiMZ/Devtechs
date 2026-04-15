import { Module } from '@nestjs/common';

import { PermissionGuard } from '../../common/guards/permission.guard';

import { PipelinesController } from './pipelines.controller';
import { PipelinesGateway } from './pipelines.gateway';
import { PipelinesService } from './pipelines.service';

@Module({
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelinesGateway, PermissionGuard],
  exports: [PipelinesService, PipelinesGateway],
})
export class PipelinesModule {}
