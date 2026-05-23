import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type {
  CancelRecurringSubscriptionDto,
  CreateRecurringSubscriptionDto,
  UpdateRecurringSubscriptionDto,
} from './dto/recurring-subscription.dto';

@Injectable()
export class RecurringSubscriptionsService {
  private readonly logger = new Logger(RecurringSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(filters?: { clientId?: string; status?: string }): Promise<unknown[]> {
    const where: Record<string, unknown> = {};
    if (filters?.clientId) where['clientId'] = filters.clientId;
    if (filters?.status) where['status'] = filters.status;

    const rows = await this.prisma.recurringSubscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    return rows.map(this.serialize);
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.recurringSubscription.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, category: true } } } },
      },
    });
    if (!row) throw new NotFoundException('RecurringSubscription not found');
    return this.serialize(row);
  }

  async create(dto: CreateRecurringSubscriptionDto, staffId: string): Promise<unknown> {
    const client = await this.prisma.user.findUnique({
      where: { id: dto.clientId },
      select: { id: true, name: true, email: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    const items = dto.items.map((item) => ({
      ...item,
      total: Number(item.quantity) * Number(item.unitPrice),
    }));

    const row = await this.prisma.recurringSubscription.create({
      data: {
        clientId: dto.clientId,
        name: dto.name,
        description: dto.description ?? null,
        billingDay: dto.billingDay,
        billingDueDays: dto.billingDueDays ?? 5,
        nextBillingDate: new Date(dto.nextBillingDate),
        notes: dto.notes ?? null,
        createdBy: staffId,
        items: {
          create: items.map((item) => ({
            productId: item.productId ?? null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    this.logger.log(
      `RecurringSubscription ${row.id} created for client ${client.name} by staff ${staffId}`,
    );

    const serialized = this.serialize(row) as Record<string, unknown>;
    const monthlyTotal = (serialized['monthlyTotal'] as number) ?? 0;
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyTotal);
    const nextBillingDate = (serialized['nextBillingDate'] as string ?? '').split('T')[0] ?? '';
    const nextBillingFormatted = nextBillingDate
      ? new Date(nextBillingDate + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';

    await this.redis.publish(
      'finance:subscription:created',
      JSON.stringify({
        publishedAt: new Date().toISOString(),
        payload: {
          subscriptionId: row.id,
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          subscriptionName: dto.name,
          monthlyTotal: brl,
          nextBillingDate: nextBillingFormatted,
        },
      }),
    );

    return serialized;
  }

  async update(id: string, dto: UpdateRecurringSubscriptionDto): Promise<unknown> {
    const existing = await this.prisma.recurringSubscription.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('RecurringSubscription not found');
    if (existing.status === 'EXPIRED' || existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot update a cancelled or expired subscription');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.recurringSubscription.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          billingDay: dto.billingDay,
          billingDueDays: dto.billingDueDays,
          nextBillingDate: dto.nextBillingDate ? new Date(dto.nextBillingDate) : undefined,
          notes: dto.notes,
        },
      });

      if (dto.items !== undefined) {
        await tx.recurringSubscriptionItem.deleteMany({ where: { subscriptionId: id } });
        if (dto.items.length > 0) {
          await tx.recurringSubscriptionItem.createMany({
            data: dto.items.map((item) => ({
              subscriptionId: id,
              productId: item.productId ?? null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: Number(item.quantity) * Number(item.unitPrice),
            })),
          });
        }
      }
    });

    return this.get(id);
  }

  async cancel(id: string, dto: CancelRecurringSubscriptionDto, staffId: string): Promise<unknown> {
    const sub = await this.prisma.recurringSubscription.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });
    if (!sub) throw new NotFoundException('RecurringSubscription not found');
    if (sub.status !== 'ACTIVE' && sub.status !== 'SUSPENDED') {
      throw new BadRequestException('Only ACTIVE or SUSPENDED subscriptions can be cancelled');
    }

    // If immediate=true, end now. Otherwise, end at next billing date (end of period).
    const endsAt = dto.immediate
      ? new Date()
      : new Date(sub.nextBillingDate);

    const updated = await this.prisma.recurringSubscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason ?? null,
        endsAt,
      },
    });

    // Calculate monthly total for notifications
    const monthlyTotal = sub.items.reduce((sum, item) => sum + Number(item.total), 0);
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      monthlyTotal,
    );
    const endsAtFormatted = endsAt.toLocaleDateString('pt-BR');

    // Notify client via dedicated subscription channel (checks user preferences)
    await this.redis.publish(
      'finance:subscription:cancelled',
      JSON.stringify({
        publishedAt: new Date().toISOString(),
        payload: {
          subscriptionId: id,
          clientId: sub.clientId,
          clientName: sub.client.name,
          clientEmail: sub.client.email,
          subscriptionName: sub.name,
          monthlyTotal: brl,
          endsAt: endsAtFormatted,
          immediate: dto.immediate ?? false,
          cancelReason: dto.reason ?? null,
        },
      }),
    );

    // Notify finance team
    await this.redis.publish(
      'notifications:inapp',
      JSON.stringify({
        publishedAt: new Date().toISOString(),
        payload: {
          role: 'FINANCEIRO',
          title: 'Assinatura de cliente cancelada',
          body: `Assinatura "${sub.name}" do cliente ${sub.client.name} cancelada por ${staffId}. Encerra em ${endsAtFormatted}.`,
          type: 'subscription.cancelled.staff',
          link: `/admin/financeiro/assinaturas/${id}`,
        },
      }),
    );

    // Notify developer team if subscription has VPS-related items
    const hasVpsItem = sub.items.some(
      (item) =>
        item.description.toLowerCase().includes('vps') ||
        item.description.toLowerCase().includes('servidor'),
    );
    if (hasVpsItem) {
      await this.redis.publish(
        'notifications:inapp',
        JSON.stringify({
          publishedAt: new Date().toISOString(),
          payload: {
            role: 'DEVELOPER',
            title: 'Assinatura VPS cancelada',
            body: `Assinatura "${sub.name}" do cliente ${sub.client.name} inclui VPS/servidor e foi cancelada. Encerra em ${endsAtFormatted}.`,
            type: 'subscription.vps.cancelled',
            link: `/admin/developer/vps`,
          },
        }),
      );
    }

    this.logger.log(
      `RecurringSubscription ${id} cancelled by staff ${staffId}. endsAt=${endsAt.toISOString()}`,
    );
    return this.serialize(updated);
  }

  /**
   * Called by the daily scheduler to notify clients whose subscription
   * billing date is exactly 3 days away.
   */
  async sendPaymentDueReminders(): Promise<{ sent: number }> {
    const target = new Date();
    target.setDate(target.getDate() + 3);
    target.setHours(0, 0, 0, 0);
    const targetEnd = new Date(target);
    targetEnd.setHours(23, 59, 59, 999);

    const due = await this.prisma.recurringSubscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: { gte: target, lte: targetEnd },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    let sent = 0;
    for (const sub of due) {
      const monthlyTotal = sub.items.reduce((sum, item) => sum + Number(item.total), 0);
      const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthlyTotal);
      const dateFormatted = sub.nextBillingDate.toLocaleDateString('pt-BR');

      await this.redis.publish(
        'finance:subscription:payment:due',
        JSON.stringify({
          publishedAt: new Date().toISOString(),
          payload: {
            subscriptionId: sub.id,
            clientId: sub.clientId,
            clientName: sub.client.name,
            clientEmail: sub.client.email,
            subscriptionName: sub.name,
            monthlyTotal: brl,
            nextBillingDate: dateFormatted,
            daysUntilDue: 3,
          },
        }),
      );
      sent++;
    }

    this.logger.log(`Payment due reminders sent: ${sent}`);
    return { sent };
  }

  /**
   * Called by the daily scheduler to generate invoices for all active
   * subscriptions where nextBillingDate <= today.
   */
  async runBillingCycle(): Promise<{ generated: number; errors: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = await this.prisma.recurringSubscription.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: { lte: today },
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
    });

    let generated = 0;
    let errors = 0;

    for (const sub of due) {
      try {
        await this.generateInvoice(sub);
        generated++;
      } catch (err) {
        this.logger.error(
          `Failed to generate invoice for subscription ${sub.id}: ${String(err)}`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Billing cycle complete: ${generated} invoices generated, ${errors} errors`,
    );
    return { generated, errors };
  }

  private async generateInvoice(sub: {
    id: string;
    clientId: string;
    name: string;
    billingDueDays: number;
    nextBillingDate: Date;
    client: { id: string; name: string; email: string };
    items: Array<{
      description: string;
      quantity: { toString(): string };
      unitPrice: { toString(): string };
      total: { toString(): string };
    }>;
  }): Promise<void> {
    const issuedAt = new Date();
    const dueDate = new Date(issuedAt);
    dueDate.setDate(dueDate.getDate() + sub.billingDueDays);

    const subtotal = sub.items.reduce((sum, item) => sum + Number(item.total), 0);

    // Find a staff creator (any admin user)
    const adminUser = await this.prisma.user.findFirst({
      where: {
        roles: {
          some: { role: { name: 'admin' } },
        },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!adminUser) {
      throw new Error('No admin user found for invoice creation');
    }

    // Generate invoice number (same logic as invoices.service)
    const year = issuedAt.getFullYear();
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { number: { startsWith: `${year}-` } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const lastSeq = lastInvoice
      ? parseInt(lastInvoice.number.split('-')[1] ?? '0', 10)
      : 0;
    const nextNumber = `${year}-${String(lastSeq + 1).padStart(4, '0')}`;

    await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          number: nextNumber,
          clientId: sub.clientId,
          subtotal,
          tax: 0,
          total: subtotal,
          status: 'SENT',
          issuedAt,
          dueDate,
          createdBy: adminUser.id,
          notes: `Cobrança recorrente: ${sub.name} | SUB:${sub.id}`,
          items: {
            create: sub.items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              total: Number(item.total),
            })),
          },
        },
      });

      // Advance nextBillingDate by one month
      const nextBillingDate = new Date(sub.nextBillingDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      await tx.recurringSubscription.update({
        where: { id: sub.id },
        data: { nextBillingDate },
      });

      this.logger.log(
        `Invoice ${invoice.number} generated for subscription ${sub.id} (client: ${sub.client.name})`,
      );
    });

    // Notify client
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      subtotal,
    );
    await this.redis.publish(
      'notifications:inapp',
      JSON.stringify({
        publishedAt: new Date().toISOString(),
        payload: {
          userId: sub.clientId,
          title: 'Nova fatura gerada',
          body: `Uma nova fatura de ${brl} foi gerada para "${sub.name}". Vencimento em ${dueDate.toLocaleDateString('pt-BR')}.`,
          type: 'invoice.created',
          link: `/perfil/faturas`,
        },
      }),
    );
  }

  private serialize(row: Record<string, unknown>): unknown {
    const items = Array.isArray(row['items'])
      ? (row['items'] as Array<Record<string, unknown>>).map((item) => ({
          id: item['id'],
          productId: item['productId'] ?? null,
          product: item['product'] ?? null,
          description: item['description'],
          quantity: Number(item['quantity']),
          unitPrice: Number(item['unitPrice']),
          total: Number(item['total']),
        }))
      : [];

    return {
      id: row['id'],
      clientId: row['clientId'],
      client: row['client'] ?? null,
      creator: row['creator'] ?? null,
      name: row['name'],
      description: row['description'] ?? null,
      status: row['status'],
      billingDay: row['billingDay'],
      billingDueDays: row['billingDueDays'],
      nextBillingDate: row['nextBillingDate'] instanceof Date
        ? (row['nextBillingDate'] as Date).toISOString().split('T')[0]
        : row['nextBillingDate'],
      cancelledAt: row['cancelledAt'] ?? null,
      cancelReason: row['cancelReason'] ?? null,
      endsAt: row['endsAt'] ?? null,
      notes: row['notes'] ?? null,
      createdAt: row['createdAt'] instanceof Date
        ? (row['createdAt'] as Date).toISOString()
        : row['createdAt'],
      updatedAt: row['updatedAt'] instanceof Date
        ? (row['updatedAt'] as Date).toISOString()
        : row['updatedAt'],
      items,
      monthlyTotal: items.reduce((sum: number, item) => sum + (item['total'] as number), 0),
    };
  }
}
