import { Module } from '@nestjs/common';

import { AuthClientModule } from '../../auth-client/auth-client.module';
import { DockerModule } from '../docker/docker.module';
import { MonitorEventBus } from './monitor-events.service';
import { MonitorController } from './monitor.controller';
import { MonitorGateway } from './monitor.gateway';
import { MonitorService } from './monitor.service';

@Module({
  imports: [DockerModule, AuthClientModule],
  controllers: [MonitorController],
  providers: [MonitorEventBus, MonitorService, MonitorGateway],
  exports: [MonitorService],
})
export class MonitorModule {}
