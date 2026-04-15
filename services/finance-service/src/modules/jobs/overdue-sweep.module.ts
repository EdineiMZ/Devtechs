import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import {
  FINANCE_JOBS_QUEUE,
  OverdueSweepProcessor,
} from './overdue-sweep.processor';
import { OverdueSweepScheduler } from './overdue-sweep.scheduler';

/**
 * Wires the BullMQ queue + processor + cron scheduler for the
 * daily OVERDUE sweep. The queue registration is scoped to this
 * module so other finance features can register their own queues
 * later without a name collision.
 */
@Module({
  imports: [BullModule.registerQueue({ name: FINANCE_JOBS_QUEUE })],
  providers: [OverdueSweepProcessor, OverdueSweepScheduler],
  exports: [BullModule],
})
export class OverdueSweepModule {}
