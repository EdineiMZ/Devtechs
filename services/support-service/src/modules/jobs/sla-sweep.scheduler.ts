import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';

import {
  SLA_SWEEP_JOB,
  SUPPORT_JOBS_QUEUE,
} from './sla-sweep.processor';

/**
 * Schedules the daily SLA sweep. @Cron drops a job on the BullMQ
 * queue every day at midnight; the processor does the actual work
 * with retries/backoff/persistence managed by BullMQ.
 *
 * We also enqueue once on module init so a service restart picks
 * up any already-overdue tickets without waiting for midnight.
 */
@Injectable()
export class SlaSweepScheduler implements OnModuleInit {
  private readonly logger = new Logger(SlaSweepScheduler.name);

  constructor(
    @InjectQueue(SUPPORT_JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Startup enqueue is best-effort — missing Redis in dev
    // shouldn't keep the service from booting.
    await this.enqueue('startup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'support-sla-sweep',
    timeZone: 'America/Sao_Paulo',
  })
  async scheduleDailySweep(): Promise<void> {
    await this.enqueue('daily');
  }

  private async enqueue(trigger: 'startup' | 'daily'): Promise<void> {
    try {
      await this.queue.add(
        SLA_SWEEP_JOB,
        { trigger, enqueuedAt: new Date().toISOString() },
        {
          removeOnComplete: { age: 7 * 24 * 60 * 60, count: 100 },
          removeOnFail: { age: 30 * 24 * 60 * 60 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
      this.logger.log(`Enqueued SLA sweep (${trigger})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SLA sweep enqueue failed (${trigger}): ${reason}`);
    }
  }
}
