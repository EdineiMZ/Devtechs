import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { EnvironmentsModule } from '../environments/environments.module';
import { PipelinesModule } from '../pipelines/pipelines.module';

import { DEVOPS_JOBS_QUEUE, HealthCheckProcessor } from './health-check.processor';
import { HealthCheckScheduler } from './health-check.scheduler';

/**
 * BullMQ queue + processor + cron for the environment health
 * sweep. Imports EnvironmentsModule for the probe-persist path
 * and PipelinesModule to borrow PipelinesGateway for the
 * `environment:status` WebSocket broadcast.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: DEVOPS_JOBS_QUEUE }),
    EnvironmentsModule,
    PipelinesModule,
  ],
  providers: [HealthCheckProcessor, HealthCheckScheduler],
  exports: [BullModule],
})
export class HealthCheckModule {}
