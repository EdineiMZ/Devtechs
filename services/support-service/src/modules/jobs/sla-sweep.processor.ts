import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export const SUPPORT_JOBS_QUEUE = 'support-jobs';
export const SLA_SWEEP_JOB = 'check-sla';

/** How close to the SLA deadline counts as "about to breach". */
const WARNING_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

interface SlaAlert {
  event: 'support.ticket.sla-warning' | 'support.ticket.sla-breach';
  occurredAt: string;
  ticketId: string;
  ticketNumber: number;
  priority: string;
  assigneeId: string | null;
  slaDeadline: string;
}

/**
 * BullMQ processor that finds tickets at risk of SLA breach and
 * publishes alerts on the `support:sla:breach` Redis channel.
 * notification-service picks those up and fans them out as
 * emails/in-app notifications.
 *
 * The query uses the `slaDeadline` index on `support_tickets` so
 * the daily sweep scans only rows near the danger zone, not the
 * whole table.
 */
@Processor(SUPPORT_JOBS_QUEUE)
export class SlaSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaSweepProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job): Promise<{ warnings: number; breaches: number }> {
    if (job.name !== SLA_SWEEP_JOB) {
      this.logger.warn(`Ignoring unknown job ${job.name} in ${SUPPORT_JOBS_QUEUE}`);
      return { warnings: 0, breaches: 0 };
    }

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + WARNING_WINDOW_MS);

    // Warnings: slaDeadline in the next 2 hours, still active.
    const warnings = await this.prisma.ticket.findMany({
      where: {
        slaDeadline: { gt: now, lte: warningThreshold },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      select: {
        id: true,
        number: true,
        priority: true,
        assigneeId: true,
        slaDeadline: true,
      },
    });

    // Breaches: slaDeadline already passed, still active.
    const breaches = await this.prisma.ticket.findMany({
      where: {
        slaDeadline: { lt: now },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
      select: {
        id: true,
        number: true,
        priority: true,
        assigneeId: true,
        slaDeadline: true,
      },
    });

    for (const t of warnings) {
      await this.publishAlert({
        event: 'support.ticket.sla-warning',
        occurredAt: now.toISOString(),
        ticketId: t.id,
        ticketNumber: t.number,
        priority: t.priority,
        assigneeId: t.assigneeId,
        slaDeadline: t.slaDeadline!.toISOString(),
      });
    }
    for (const t of breaches) {
      await this.publishAlert({
        event: 'support.ticket.sla-breach',
        occurredAt: now.toISOString(),
        ticketId: t.id,
        ticketNumber: t.number,
        priority: t.priority,
        assigneeId: t.assigneeId,
        slaDeadline: t.slaDeadline!.toISOString(),
      });
    }

    this.logger.log(
      `SLA sweep: ${warnings.length} warning(s), ${breaches.length} breach(es)`,
    );
    return { warnings: warnings.length, breaches: breaches.length };
  }

  private async publishAlert(alert: SlaAlert): Promise<void> {
    try {
      await this.redis.publish('support:sla:breach', JSON.stringify(alert));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to publish SLA alert: ${reason}`);
    }
  }
}
