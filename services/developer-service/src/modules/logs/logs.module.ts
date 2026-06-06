import { Module } from '@nestjs/common';

import { DockerModule } from '../docker/docker.module';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [DockerModule],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
