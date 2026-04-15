import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';

import {
  FINANCE_JOBS_QUEUE,
  OVERDUE_SWEEP_JOB,
} from './overdue-sweep.processor';

/**
 * Schedules the daily overdue-transaction sweep.
 *
 * Uses @nestjs/schedule's @Cron decorator to enqueue the BullMQ
 * job at midnight. BullMQ (not @Cron) is the source of truth for
 * execution — this scheduler is just the trigger that drops a
 * job on the queue every 24h. The actual work runs inside
 * `OverdueSweepProcessor`, which means it gets retries, backoff,
 * and persistence for free.
 *
 * On module init we also run the sweep once so a service restart
 * that happens to land on an already-overdue period catches up
 * without waiting for midnight.
 */
@Injectable()
export class OverdueSweepScheduler implements OnModuleInit {
  private readonly logger = new Logger(OverdueSweepScheduler.name);

  constructor(
    @InjectQueue(FINANCE_JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.enqueue('startup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'finance-overdue-sweep',
    timeZone: 'America/Sao_Paulo',
  })
  async scheduleDailySweep(): Promise<void> {
    await this.enqueue('daily');
  }

  private async enqueue(trigger: 'startup' | 'daily'): Promise<void> {
    await this.queue.add(
      OVERDUE_SWEEP_JOB,
      { trigger, enqueuedAt: new Date().toISOString() },
      {
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 100 },
        removeOnFail: { age: 30 * 24 * 60 * 60 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );
    this.logger.log(`Enqueued overdue sweep (${trigger})`);
  }
}
