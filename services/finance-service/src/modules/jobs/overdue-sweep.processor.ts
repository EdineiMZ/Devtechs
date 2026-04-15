import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export const FINANCE_JOBS_QUEUE = 'finance-jobs';
export const OVERDUE_SWEEP_JOB = 'check-overdue';

/** Shape of the alert message published on the `finance:alerts`
 *  channel — consumed by notification-service. */
interface OverdueAlert {
  event: 'finance.transaction.overdue';
  occurredAt: string;
  count: number;
  ids: string[];
}

/**
 * BullMQ processor for the `finance-jobs` queue.
 *
 * The processor runs inside the finance-service process (no
 * external worker) because the workload is tiny — one daily
 * UPDATE + one Pub/Sub publish. Scaling up to a dedicated worker
 * is a one-line change (move `OverdueSweepModule` into its own
 * Nest bootstrap and keep `BullModule.forRoot`).
 *
 * The scan uses the `(status, dueDate)` composite index on
 * `finance_transactions` — a single index range scan for
 * `status = 'PENDING' AND dueDate < now()`.
 */
@Processor(FINANCE_JOBS_QUEUE)
export class OverdueSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(OverdueSweepProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ updated: number }> {
    if (job.name !== OVERDUE_SWEEP_JOB) {
      this.logger.warn(`Ignoring unknown job ${job.name} in finance-jobs`);
      return { updated: 0 };
    }

    const now = new Date();
    this.logger.log(`Starting overdue sweep at ${now.toISOString()}`);

    // Find-before-update so we can collect the IDs for the alert
    // payload without a separate SELECT after the UPDATE.
    const overdue = await this.prisma.financeTransaction.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: now },
      },
      select: { id: true },
    });

    if (overdue.length === 0) {
      this.logger.log('No overdue transactions this run');
      return { updated: 0 };
    }

    const ids = overdue.map((r) => r.id);
    const { count } = await this.prisma.financeTransaction.updateMany({
      where: { id: { in: ids } },
      data: { status: 'OVERDUE' },
    });

    this.logger.log(`Flagged ${count} transactions as OVERDUE`);

    // Fire-and-forget notification — the service never blocks
    // on downstream consumers. If Redis is unreachable the error
    // is logged but the job still reports success because the
    // data was already updated.
    const alert: OverdueAlert = {
      event: 'finance.transaction.overdue',
      occurredAt: now.toISOString(),
      count,
      ids,
    };
    try {
      await this.redis.publish('finance:alerts', JSON.stringify(alert));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to publish overdue alert: ${reason}`);
    }

    return { updated: count };
  }
}
