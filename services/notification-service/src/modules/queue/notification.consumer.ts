import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { EmailService, type EmailTemplate } from '../email/email.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';

import {
  JOB_CREATE_INAPP,
  JOB_SEND_EMAIL,
  NOTIFICATIONS_QUEUE,
  type CreateInappJob,
  type SendEmailJob,
} from './queue.constants';

/**
 * BullMQ worker for the `notifications` queue.
 *
 * Dispatches by `job.name`:
 *
 *   - `send-email`    → EmailService.send()
 *   - `create-inapp`  → NotificationService.create() + gateway push
 *
 * BullMQ gives us retries, exponential backoff, and a failed-job
 * log for free. Throwing from `process()` triggers a retry; the
 * subscriber configures attempts/backoff when it enqueues.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
    private readonly gateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case JOB_SEND_EMAIL:
        return this.handleEmail(job as Job<SendEmailJob>);
      case JOB_CREATE_INAPP:
        return this.handleInapp(job as Job<CreateInappJob>);
      default:
        this.logger.warn(`Unknown job name: ${job.name} (id: ${job.id})`);
        return { skipped: true };
    }
  }

  // -------------------------------------------------------------------
  // send-email
  // -------------------------------------------------------------------

  private async handleEmail(
    job: Job<SendEmailJob>,
  ): Promise<{ id: string | null }> {
    const { to, subject, template, data, from, replyTo } = job.data;
    this.logger.log(
      `Processing send-email job ${job.id} (${template} → ${Array.isArray(to) ? to.join(', ') : to})`,
    );
    return this.email.send({
      to,
      subject,
      template: template as EmailTemplate,
      data,
      from,
      replyTo,
    });
  }

  // -------------------------------------------------------------------
  // create-inapp
  // -------------------------------------------------------------------

  private async handleInapp(
    job: Job<CreateInappJob>,
  ): Promise<{ id: string }> {
    const { userId, title, body, type, link } = job.data;
    this.logger.log(
      `Processing create-inapp job ${job.id} (${type} → ${userId})`,
    );

    const saved = await this.notifications.create({
      userId,
      title,
      body,
      type,
      link: link ?? null,
    });

    // Fire-and-forget push — the gateway swallows write errors
    // to a disconnected socket, so a missing client doesn't
    // retry the whole Prisma insert.
    try {
      this.gateway.pushToUser(userId, saved);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WebSocket push failed for ${userId}: ${reason}`);
    }

    return { id: saved.id };
  }
}
