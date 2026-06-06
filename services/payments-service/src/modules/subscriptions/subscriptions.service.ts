import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../providers/payment-provider.interface';
import type { CreateSubscriptionDto } from './dto/subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /**
   * Create subscription for a user.
   * 1. Load + validate plan.
   * 2. Optionally apply coupon discount.
   * 3. Compute billing period.
   * 4. Handle trial.
   * 5. Call payment provider.
   * 6. Persist Subscription + Payment.
   * 7. Increment coupon usage.
   */
  async create(userId: string, dto: CreateSubscriptionDto, payerEmail: string): Promise<unknown> {
    const { planId, couponCode, method } = dto;
    const paymentMethod = (method ?? 'PIX').toUpperCase() as
      | 'PIX'
      | 'BOLETO'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD';

    // Step 1 — load plan.
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    if (!plan.isActive) throw new UnprocessableEntityException('Plan is not active');

    // Step 2 — coupon.
    let finalPrice = Number(plan.price);
    let couponId: string | null = null;

    if (couponCode) {
      const now = new Date();
      const found = await this.prisma.coupon.findFirst({
        where: {
          code: couponCode.toLowerCase(),
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });
      if (!found) throw new UnprocessableEntityException('Coupon is invalid or expired');
      if (found.maxUses > 0 && found.usedCount >= found.maxUses) {
        throw new UnprocessableEntityException('Coupon usage limit reached');
      }
      couponId = found.id;
      const discount = Number(found.discount);
      if (found.type === 'PERCENTAGE') {
        finalPrice = finalPrice * (1 - discount / 100);
      } else {
        finalPrice = Math.max(0, finalPrice - discount);
      }
    }

    // Step 3 — billing period.
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (plan.interval === 'YEARLY') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Step 4 — trial.
    const hasTrial = plan.trialDays > 0;
    const trialEnd = hasTrial
      ? new Date(periodStart.getTime() + plan.trialDays * 86_400_000)
      : null;
    const initialStatus = hasTrial ? 'TRIALING' as const : 'ACTIVE' as const;

    // Step 5 — provider call.
    const externalRef = `user:${userId}:plan:${planId}:${Date.now()}`;
    const providerResult = await this.provider.createSubscription({
      planName: plan.name,
      planPrice: finalPrice,
      interval: plan.interval === 'YEARLY' ? 'yearly' : 'monthly',
      payerEmail,
      externalReference: externalRef,
    });

    // Step 6 — persist.
    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: initialStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd,
        externalId: providerResult.externalId,
        payments: {
          create: {
            userId,
            amount: finalPrice,
            method: paymentMethod,
            status: 'PENDING',
            externalId: providerResult.externalId,
            externalUrl: providerResult.externalUrl ?? null,
            metadata: (providerResult.metadata ?? {}) as object,
          },
        },
      },
      include: { payments: true, plan: true },
    });

    // Step 7 — increment coupon usage.
    if (couponId) {
      await this.prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    this.logger.log(
      `Subscription ${subscription.id} created for user ${userId} on plan ${plan.name}`,
    );
    return {
      subscription,
      externalUrl: providerResult.externalUrl,
    };
  }

  /** Returns the most recent active or trialing subscription. */
  getMySubscription(userId: string): Promise<unknown> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  /** Cancels the user's active subscription at period end. */
  async cancelMine(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('No active subscription found');

    if (sub.externalId) {
      await this.provider.cancelSubscription(sub.externalId);
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelledAt: new Date() },
    });
  }

  /**
   * Handles a confirmed payment webhook:
   * - Marks Payment as PAID.
   * - If payment has invoiceId: marks Invoice as PAID and notifies client.
   * - If payment has subscriptionId: activates subscription if TRIALING or PAST_DUE.
   * - Publishes Redis event.
   */
  async handleWebhookPaymentConfirmed(externalPaymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalId: externalPaymentId },
      include: { subscription: true },
    });
    if (!payment) {
      this.logger.warn(`No payment found for externalId ${externalPaymentId}`);
      return;
    }

    if (payment.status === 'PAID') {
      this.logger.log(`Payment ${payment.id} already PAID — skipping (idempotent)`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // Handle invoice payment (PIX or card for a finance invoice)
    if (payment.invoiceId) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        select: { id: true, clientId: true, number: true, total: true, status: true },
      });
      if (invoice && invoice.status !== 'PAID') {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
        const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          Number(invoice.total),
        );
        await this.redis.publish(
          'notifications:inapp',
          JSON.stringify({
            publishedAt: new Date().toISOString(),
            payload: {
              userId: invoice.clientId,
              title: 'Pagamento confirmado',
              body: `Seu pagamento de ${brl} referente à fatura ${invoice.number} foi confirmado.`,
              type: 'invoice.paid',
              link: `/perfil/faturas`,
            },
          }),
        );
        this.logger.log(
          `Invoice ${invoice.id} (${invoice.number}) marked PAID via payment ${payment.id}`,
        );
      }
    }

    // Handle SaaS subscription payment
    const sub = payment.subscription;
    if (sub && (sub.status === 'TRIALING' || sub.status === 'PAST_DUE')) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });
      await this.redis.publish(
        'subscription:activated',
        JSON.stringify({ subscriptionId: sub.id, userId: sub.userId }),
      );
      this.logger.log(`Subscription ${sub.id} activated via payment ${payment.id}`);
    }
  }
}
