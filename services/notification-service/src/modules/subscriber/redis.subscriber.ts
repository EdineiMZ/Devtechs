import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type Redis from 'ioredis';

import { RedisService } from '../../redis/redis.service';
import {
  JOB_CREATE_INAPP,
  JOB_SEND_EMAIL,
  NOTIFICATIONS_QUEUE,
} from '../queue/queue.constants';

/** Channels the subscriber listens on. Producers use the same names. */
const CHANNEL_EMAIL = 'notifications:email';
const CHANNEL_INAPP = 'notifications:inapp';
const CHANNEL_VACATION_APPROVED = 'rh:vacation:approved';
const CHANNEL_VACATION_REJECTED = 'rh:vacation:rejected';
const CHANNEL_FINANCE_ALERTS = 'finance:alerts';
const CHANNEL_SUBSCRIPTION_CREATED = 'finance:subscription:created';
const CHANNEL_SUBSCRIPTION_CANCELLED = 'finance:subscription:cancelled';
const CHANNEL_SUBSCRIPTION_PAYMENT_DUE = 'finance:subscription:payment:due';

/** Default preference values for the subscription category. */
const SUBSCRIPTION_PREF_DEFAULTS: Record<string, boolean> = {
  'email.subscription': true,
  'inapp.subscription': true,
};

/** Envelope shape published by the other services. */
interface PubSubEnvelope<T = unknown> {
  channel?: string;
  publishedAt?: string;
  payload: T;
}

interface EmailEventPayload {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  /** Sender override — any address on the verified domain. Falls back to RESEND_FROM env. */
  from?: string;
  replyTo?: string;
}

interface InappEventPayload {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string | null;
}

interface SubscriptionCreatedPayload {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  subscriptionName: string;
  monthlyTotal: string;
  nextBillingDate: string;
}

interface SubscriptionCancelledPayload {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  subscriptionName: string;
  monthlyTotal: string;
  endsAt: string;
  immediate: boolean;
  cancelReason?: string | null;
}

interface SubscriptionPaymentDuePayload {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  subscriptionName: string;
  monthlyTotal: string;
  nextBillingDate: string;
  daysUntilDue: number;
}

interface VacationEventPayload {
  vacationId: string;
  employee: { id: string; email: string; name: string };
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  rejectionReason?: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
}

/**
 * Redis Pub/Sub subscriber.
 *
 * Uses a DEDICATED ioredis connection obtained via `.duplicate()`
 * on the shared command client because once a client enters
 * subscribe mode it can't issue regular commands. The normal
 * RedisService stays in command mode for the rest of the service.
 *
 * Every message is translated into a BullMQ job on the
 * `notifications` queue so the consumer owns retries, backoff,
 * and failure logging uniformly — the subscriber itself never
 * performs side effects.
 */
@Injectable()
export class RedisSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriber.name);
  private subscriber!: Redis;

  constructor(
    private readonly redis: RedisService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // `.duplicate()` keeps the same connection options (host,
    // port, retries) but opens a second TCP socket so the main
    // client can still issue commands.
    this.subscriber = this.redis.getClient().duplicate();
    this.subscriber.on('error', (err) =>
      this.logger.error(`Subscriber error: ${err.message}`),
    );

    const channels = [
      CHANNEL_EMAIL,
      CHANNEL_INAPP,
      CHANNEL_VACATION_APPROVED,
      CHANNEL_VACATION_REJECTED,
      CHANNEL_FINANCE_ALERTS,
      CHANNEL_SUBSCRIPTION_CREATED,
      CHANNEL_SUBSCRIPTION_CANCELLED,
      CHANNEL_SUBSCRIPTION_PAYMENT_DUE,
    ];
    await this.subscriber.subscribe(...channels);
    this.logger.log(`Subscribed to ${channels.length} channel(s): ${channels.join(', ')}`);

    this.subscriber.on('message', (channel, message) => {
      void this.handleMessage(channel, message).catch((err) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to handle message on ${channel}: ${reason}`);
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.subscriber?.unsubscribe();
      await this.subscriber?.quit();
    } catch {
      /* already closed */
    }
  }

  // -------------------------------------------------------------------
  // Channel dispatch
  // -------------------------------------------------------------------

  private async handleMessage(channel: string, message: string): Promise<void> {
    const envelope = this.parseEnvelope(message);
    if (!envelope) {
      this.logger.warn(`Dropping malformed message on ${channel}`);
      return;
    }

    switch (channel) {
      case CHANNEL_EMAIL:
        return this.enqueueEmail(envelope.payload as EmailEventPayload);
      case CHANNEL_INAPP:
        return this.enqueueInapp(envelope.payload as InappEventPayload);
      case CHANNEL_VACATION_APPROVED:
        return this.handleVacationApproved(envelope.payload as VacationEventPayload);
      case CHANNEL_VACATION_REJECTED:
        return this.handleVacationRejected(envelope.payload as VacationEventPayload);
      case CHANNEL_FINANCE_ALERTS:
        return this.handleFinanceAlert(envelope.payload);
      case CHANNEL_SUBSCRIPTION_CREATED:
        return this.handleSubscriptionCreated(envelope.payload as SubscriptionCreatedPayload);
      case CHANNEL_SUBSCRIPTION_CANCELLED:
        return this.handleSubscriptionCancelled(envelope.payload as SubscriptionCancelledPayload);
      case CHANNEL_SUBSCRIPTION_PAYMENT_DUE:
        return this.handleSubscriptionPaymentDue(envelope.payload as SubscriptionPaymentDuePayload);
      default:
        this.logger.warn(`No handler for channel ${channel}`);
    }
  }

  private async enqueueEmail(payload: EmailEventPayload): Promise<void> {
    if (!payload?.to || !payload.template) {
      this.logger.warn('email payload missing required fields');
      return;
    }
    await this.queue.add(JOB_SEND_EMAIL, payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
    this.logger.log(
      `Queued email: ${payload.template} → ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to}`,
    );
  }

  private async enqueueInapp(payload: InappEventPayload): Promise<void> {
    if (!payload?.userId || !payload.title || !payload.type) {
      this.logger.warn('inapp payload missing required fields');
      return;
    }
    await this.queue.add(JOB_CREATE_INAPP, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    });
    this.logger.log(`Queued inapp: ${payload.type} → ${payload.userId}`);
  }

  // -------------------------------------------------------------------
  // RH domain translations — fan out one event into both an
  // email and an in-app notification so the consumer doesn't
  // need domain knowledge.
  // -------------------------------------------------------------------

  private async handleVacationApproved(
    payload: VacationEventPayload,
  ): Promise<void> {
    await this.enqueueEmail({
      to: payload.employee.email,
      subject: 'Suas férias foram aprovadas — SZDevs',
      template: 'vacation-approved',
      from: 'RH SZDevs <rh@szdevs.com>',
      data: {
        name: payload.employee.name,
        type: payload.type,
        startDate: payload.startDate,
        endDate: payload.endDate,
        daysCount: payload.daysCount,
        reviewerName: payload.reviewedBy?.name ?? 'RH',
      },
    });
    await this.enqueueInapp({
      userId: payload.employee.id,
      title: 'Férias aprovadas',
      body: `Seu pedido de ${payload.startDate} a ${payload.endDate} foi aprovado.`,
      type: 'vacation.approved',
      link: `/rh/ferias/${payload.vacationId}`,
    });
  }

  private async handleVacationRejected(
    payload: VacationEventPayload,
  ): Promise<void> {
    await this.enqueueEmail({
      to: payload.employee.email,
      subject: 'Sua solicitação de férias não foi aprovada — SZDevs',
      template: 'vacation-rejected',
      from: 'RH SZDevs <rh@szdevs.com>',
      data: {
        name: payload.employee.name,
        startDate: payload.startDate,
        endDate: payload.endDate,
        daysCount: payload.daysCount,
        rejectionReason: payload.rejectionReason ?? 'Sem motivo informado',
        reviewerName: payload.reviewedBy?.name ?? 'RH',
      },
    });
    await this.enqueueInapp({
      userId: payload.employee.id,
      title: 'Férias não aprovadas',
      body: payload.rejectionReason ?? 'Sua solicitação de férias não foi aprovada.',
      type: 'vacation.rejected',
      link: `/rh/ferias/${payload.vacationId}`,
    });
  }

  // -------------------------------------------------------------------
  // Subscription domain — preference-aware fan-out
  // -------------------------------------------------------------------

  private async getSubscriptionPref(userId: string, channel: 'email' | 'inapp'): Promise<boolean> {
    const hash = await this.redis.hgetall(`SZDevs:notif:prefs:${userId}`);
    const field = `${channel}.subscription`;
    if (field in hash) return hash[field] === 'true';
    return SUBSCRIPTION_PREF_DEFAULTS[field] ?? true;
  }

  private async handleSubscriptionCreated(payload: SubscriptionCreatedPayload): Promise<void> {
    const [wantsEmail, wantsInapp] = await Promise.all([
      this.getSubscriptionPref(payload.clientId, 'email'),
      this.getSubscriptionPref(payload.clientId, 'inapp'),
    ]);

    if (wantsEmail) {
      await this.enqueueEmail({
        to: payload.clientEmail,
        subject: `Assinatura "${payload.subscriptionName}" confirmada — SZDevs`,
        template: 'subscription-created',
        from: 'Financeiro SZDevs <financeiro@szdevs.com>',
        data: {
          clientName: payload.clientName,
          subscriptionName: payload.subscriptionName,
          monthlyTotal: payload.monthlyTotal,
          nextBillingDate: payload.nextBillingDate,
        },
      });
    }

    if (wantsInapp) {
      await this.enqueueInapp({
        userId: payload.clientId,
        title: 'Assinatura confirmada',
        body: `"${payload.subscriptionName}" (${payload.monthlyTotal}/mês) está ativa. Próxima cobrança: ${payload.nextBillingDate}.`,
        type: 'subscription.created',
        link: '/perfil/faturas',
      });
    }
  }

  private async handleSubscriptionCancelled(payload: SubscriptionCancelledPayload): Promise<void> {
    const [wantsEmail, wantsInapp] = await Promise.all([
      this.getSubscriptionPref(payload.clientId, 'email'),
      this.getSubscriptionPref(payload.clientId, 'inapp'),
    ]);

    if (wantsEmail) {
      await this.enqueueEmail({
        to: payload.clientEmail,
        subject: `Assinatura "${payload.subscriptionName}" cancelada — SZDevs`,
        template: 'subscription-cancelled',
        from: 'Financeiro SZDevs <financeiro@szdevs.com>',
        data: {
          clientName: payload.clientName,
          subscriptionName: payload.subscriptionName,
          monthlyTotal: payload.monthlyTotal,
          endsAt: payload.endsAt,
          cancelReason: payload.cancelReason ?? null,
        },
      });
    }

    if (wantsInapp) {
      await this.enqueueInapp({
        userId: payload.clientId,
        title: 'Assinatura cancelada',
        body: `"${payload.subscriptionName}" (${payload.monthlyTotal}/mês) foi cancelada. Acesso até ${payload.endsAt}.`,
        type: 'subscription.cancelled',
        link: '/perfil/faturas',
      });
    }
  }

  private async handleSubscriptionPaymentDue(payload: SubscriptionPaymentDuePayload): Promise<void> {
    const [wantsEmail, wantsInapp] = await Promise.all([
      this.getSubscriptionPref(payload.clientId, 'email'),
      this.getSubscriptionPref(payload.clientId, 'inapp'),
    ]);

    if (wantsEmail) {
      await this.enqueueEmail({
        to: payload.clientEmail,
        subject: `Sua cobrança de "${payload.subscriptionName}" se aproxima — SZDevs`,
        template: 'subscription-payment-due',
        from: 'Financeiro SZDevs <financeiro@szdevs.com>',
        data: {
          clientName: payload.clientName,
          subscriptionName: payload.subscriptionName,
          monthlyTotal: payload.monthlyTotal,
          nextBillingDate: payload.nextBillingDate,
          daysUntilDue: payload.daysUntilDue,
        },
      });
    }

    if (wantsInapp) {
      await this.enqueueInapp({
        userId: payload.clientId,
        title: 'Cobrança em breve',
        body: `"${payload.subscriptionName}" — ${payload.monthlyTotal} será cobrado em ${payload.daysUntilDue} dias (${payload.nextBillingDate}).`,
        type: 'subscription.payment_due',
        link: '/perfil/faturas',
      });
    }
  }

  private async handleFinanceAlert(payload: unknown): Promise<void> {
    // Finance alerts today are ops-only (console / dashboards).
    // We simply log them — no email / in-app fan-out yet because
    // the alert payload doesn't carry a userId. The overdue-sweep
    // job in finance-service is the producer; extending this to
    // per-owner notifications is a follow-up task.
    this.logger.log(`Finance alert received: ${JSON.stringify(payload)}`);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private parseEnvelope(raw: string): PubSubEnvelope | null {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && 'payload' in parsed) {
        return parsed as PubSubEnvelope;
      }
      // Legacy shape: some producers publish the payload directly.
      return { payload: parsed };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Invalid JSON on pubsub channel: ${reason}`);
      return null;
    }
  }
}
