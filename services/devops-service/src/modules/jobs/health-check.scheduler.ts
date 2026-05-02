import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Queue } from 'bullmq';

import { DEVOPS_JOBS_QUEUE, HEALTH_CHECK_JOB } from './health-check.processor';

/**
 * Drops a `check-environments` job on the BullMQ queue every
 * 5 minutes. Also enqueues one on module init so a service
 * restart immediately refreshes the status dashboard instead
 * of waiting for the next cron tick.
 */
@Injectable()
export class HealthCheckScheduler implements OnModuleInit {
  private readonly logger = new Logger(HealthCheckScheduler.name);

  constructor(
    @InjectQueue(DEVOPS_JOBS_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    // Fire-and-forget: don't block NestJS bootstrap waiting for BullMQ
    // to establish its lazy Redis connection.
    this.enqueue('startup').catch((err: Error) => {
      this.logger.warn(`Startup health sweep enqueue skipped: ${err.message}`);
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'devops-health-sweep',
    timeZone: 'America/Sao_Paulo',
  })
  async scheduleHealthSweep(): Promise<void> {
    await this.enqueue('cron');
  }

  private async enqueue(trigger: 'startup' | 'cron'): Promise<void> {
    try {
      await this.queue.add(
        HEALTH_CHECK_JOB,
        { trigger, enqueuedAt: new Date().toISOString() },
        {
          removeOnComplete: { age: 24 * 60 * 60, count: 200 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
      this.logger.log(`Enqueued health sweep (${trigger})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Health sweep enqueue failed (${trigger}): ${reason}`);
    }
  }
}
