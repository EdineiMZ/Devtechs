import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import {
  SUPPORT_JOBS_QUEUE,
  SlaSweepProcessor,
} from './sla-sweep.processor';
import { SlaSweepScheduler } from './sla-sweep.scheduler';

@Module({
  imports: [BullModule.registerQueue({ name: SUPPORT_JOBS_QUEUE })],
  providers: [SlaSweepProcessor, SlaSweepScheduler],
  exports: [BullModule],
})
export class SlaSweepModule {}
