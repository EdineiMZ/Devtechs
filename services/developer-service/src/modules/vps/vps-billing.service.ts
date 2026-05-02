import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { HostingerApiService } from './hostinger-api.service';

/**
 * Handles automatic monthly billing for VPS resources and
 * auto-suspension when a client does not pay within `suspendAfterDays`.
 *
 * Design: both operations write directly to the shared Postgres
 * database (same as finance-service) so that no inter-service HTTP
 * call is required. Invoice records created here are identical to
 * those created by the finance-service.
 */
@Injectable()
export class VpsBillingService {
  private readonly logger = new Logger(VpsBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hostinger: HostingerApiService,
  ) {}

  /**
   * Generate monthly invoices for every managed VPS that is due today.
   * A VPS is "due" when:
   *   1. `monthlyPrice` is set (non-null), AND
   *   2. `billingDayOfMonth` matches today's day-of-month, AND
   *   3. `lastBilledAt` is null OR was more than 20 days ago
   *      (20-day guard prevents double-billing on retry).
   */
  async runBillingCycle(): Promise<void> {
    const today = new Date();
    const dayOfMonth = today.getUTCDate();

    const vpsList = await this.prisma.clientVPS.findMany({
      where: {
        monthlyPrice: { not: null },
        billingDayOfMonth: dayOfMonth,
        suspendedAt: null,
        OR: [
          { lastBilledAt: null },
          {
            lastBilledAt: {
              lt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`VPS billing cycle: ${vpsList.length} VPS due today (day ${dayOfMonth})`);

    for (const vps of vpsList) {
      try {
        await this.billVps(vps);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to bill VPS ${vps.id} (${vps.label}): ${reason}`);
      }
    }
  }

  /**
   * Check for suspended-due-non-payment conditions and auto-suspend
   * any VPS whose client has an overdue unpaid invoice past the grace period.
   */
  async runSuspensionCheck(): Promise<void> {
    const vpsList = await this.prisma.clientVPS.findMany({
      where: {
        monthlyPrice: { not: null },
        suspendedAt: null,
      },
      select: {
        id: true,
        vmId: true,
        label: true,
        clientId: true,
        suspendAfterDays: true,
      },
    });

    for (const vps of vpsList) {
      try {
        await this.checkAndSuspend(vps);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(`Suspension check failed for VPS ${vps.id}: ${reason}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async billVps(vps: {
    id: string;
    clientId: string;
    projectId: string | null;
    label: string;
    monthlyPrice: unknown;
    suspendAfterDays: number;
    client: { id: string; name: string; email: string };
  }): Promise<void> {
    const amount = Number(vps.monthlyPrice);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5); // 5-day payment window

    // Generate invoice number
    const year = new Date().getUTCFullYear();
    const prefix = `${year}-`;
    const latest = await this.prisma.invoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const currentSeq = latest
      ? Number.parseInt(latest.number.slice(prefix.length), 10)
      : 0;
    const next = Number.isFinite(currentSeq) ? currentSeq + 1 : 1;
    const invoiceNumber = `${prefix}${String(next).padStart(4, '0')}`;

    // Find a system user to act as creator (the first ADMIN user)
    const creator = await this.prisma.user.findFirst({
      where: { roles: { some: { role: { name: 'ADMIN' } } } },
      select: { id: true },
    });

    if (!creator) {
      this.logger.warn(`No ADMIN user found to create VPS invoice for ${vps.id}`);
      return;
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        number: invoiceNumber,
        clientId: vps.clientId,
        projectId: vps.projectId,
        subtotal: amount,
        tax: 0,
        total: amount,
        issuedAt: new Date(),
        dueDate,
        notes: `VPS_BILLING:${vps.id} — Mensalidade VPS: ${vps.label}`,
        createdBy: creator.id,
        status: 'SENT',
        items: {
          create: [
            {
              description: `Mensalidade VPS: ${vps.label}`,
              quantity: 1,
              unitPrice: amount,
              total: amount,
            },
          ],
        },
      },
    });

    await this.prisma.clientVPS.update({
      where: { id: vps.id },
      data: { lastBilledAt: new Date() },
    });

    this.logger.log(
      `Billed VPS ${vps.id} (${vps.label}) → invoice ${invoice.number} R$ ${amount}`,
    );

    // Notify client via Redis pub/sub
    await this.publishNotification(vps.clientId, {
      title: 'Nova cobrança de VPS',
      body: `A mensalidade do VPS ${vps.label} foi gerada: R$ ${amount.toFixed(2)}`,
      type: 'vps.billing',
      link: `/financeiro/faturas/${invoice.id}`,
    });
  }

  private async checkAndSuspend(vps: {
    id: string;
    vmId: string;
    label: string;
    clientId: string;
    suspendAfterDays: number;
  }): Promise<void> {
    // Find the most recent unpaid VPS invoice for this VPS
    const overdueInvoice = await this.prisma.invoice.findFirst({
      where: {
        notes: { contains: `VPS_BILLING:${vps.id}` },
        status: { in: ['SENT', 'OVERDUE'] },
        dueDate: {
          lt: new Date(
            Date.now() - vps.suspendAfterDays * 24 * 60 * 60 * 1000,
          ),
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!overdueInvoice) return;

    this.logger.warn(
      `VPS ${vps.id} (${vps.label}) has overdue invoice ${overdueInvoice.id} — suspending`,
    );

    // Stop the VPS on Hostinger
    try {
      await this.hostinger.stopVM(vps.vmId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to stop VM ${vps.vmId} on Hostinger: ${reason}`);
    }

    await this.prisma.clientVPS.update({
      where: { id: vps.id },
      data: { suspendedAt: new Date() },
    });

    // Mark invoice as overdue
    await this.prisma.invoice.update({
      where: { id: overdueInvoice.id },
      data: { status: 'OVERDUE' },
    });

    await this.publishNotification(vps.clientId, {
      title: 'VPS suspenso por inadimplência',
      body: `O VPS ${vps.label} foi suspenso. Pague a fatura pendente para reativar.`,
      type: 'vps.suspended',
      link: `/financeiro/faturas/${overdueInvoice.id}`,
    });
  }

  private async publishNotification(
    userId: string,
    notif: { title: string; body: string; type: string; link: string },
  ): Promise<void> {
    // Use direct Redis publish via the shared Redis client
    // The notification-service subscribes to `notifications:inapp`
    const payload = {
      publishedAt: new Date().toISOString(),
      payload: { userId, ...notif },
    };
    try {
      const Redis = (await import('ioredis')).default;
      const url = process.env.REDIS_URL;
      const host = process.env.REDIS_HOST ?? 'redis';
      const port = Number(process.env.REDIS_PORT ?? '6379');
      const client = url ? new Redis(url) : new Redis({ host, port });
      await client.publish('notifications:inapp', JSON.stringify(payload));
      await client.quit();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to publish notification: ${reason}`);
    }
  }
}
