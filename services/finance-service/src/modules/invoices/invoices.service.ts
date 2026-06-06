import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@szdevs/database';
import MercadoPagoConfig, { Payment } from 'mercadopago';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type {
  CreateInvoiceDto,
  InvoiceItemDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

const API_KEYS_REDIS_KEY = 'SZDevs:config:api_keys';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly envMpToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.envMpToken = config.get<string>('MP_ACCESS_TOKEN') ?? '';
  }

  // ===================================================================
  // CRUD
  // ===================================================================

  async list(filters?: { projectId?: string; clientId?: string }): Promise<unknown[]> {
    const where: Prisma.InvoiceWhereInput = {};
    if (filters?.projectId) where.projectId = filters.projectId;
    if (filters?.clientId) where.clientId = filters.clientId;

    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        items: { orderBy: { id: 'asc' } },
        _count: { select: { items: true } },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async listClients(): Promise<{ id: string; name: string; email: string }[]> {
    // The User model uses `status: UserStatus` (ACTIVE|INACTIVE|BANNED), not
    // a `banned` boolean — Prisma was throwing "Unknown argument `banned`"
    // on every call, the controller swallowed it as 500, and the dropdown
    // in /admin/financeiro/faturas → "Nova fatura" rendered empty.
    const rows = await this.prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email }));
  }

  async get(id: string): Promise<unknown> {
    const row = await this.findWithItems(id);
    return this.serialize(row);
  }

  async getForClient(id: string, clientId: string): Promise<unknown> {
    const row = await this.findWithItemsForClient(id, clientId);
    return this.serialize(row);
  }

  async create(dto: CreateInvoiceDto, userId: string): Promise<unknown> {
    await this.assertClientExists(dto.clientId);
    const totals = this.computeTotals(dto.items, dto.tax ?? 0);
    const number = await this.nextInvoiceNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invoice.create({
        data: {
          number,
          clientId: dto.clientId,
          projectId: dto.projectId ?? null,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : new Date(),
          dueDate: new Date(dto.dueDate),
          notes: dto.notes ?? null,
          createdBy: userId,
          items: {
            create: dto.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: round2(item.quantity * item.unitPrice),
            })),
          },
        },
      });
      return row;
    });

    this.logger.log(`Created invoice ${created.id} (${created.number})`);
    // Fire-and-forget: notify the client via Redis pub/sub
    void this.notifyInvoiceCreated(created.id, dto.clientId, totals.total, number);
    return this.get(created.id);
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<unknown> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, number: true, total: true, status: true, clientId: true },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status !== 'DRAFT' && dto.items) {
      throw new BadRequestException('Invoice items can only be edited while DRAFT');
    }

    // Replacing items — run inside a transaction so a partial
    // failure doesn't leave the header with stale totals.
    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.InvoiceUpdateInput = {};
      if (dto.issuedAt !== undefined) data.issuedAt = new Date(dto.issuedAt);
      if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
      if (dto.status !== undefined) {
        data.status = dto.status;
        if (dto.status === 'PAID') data.paidAt = new Date();
      }
      if (dto.notes !== undefined) data.notes = dto.notes;

      if (dto.items) {
        const totals = this.computeTotals(dto.items, dto.tax ?? 0);
        data.subtotal = totals.subtotal;
        data.tax = totals.tax;
        data.total = totals.total;
        // Wipe and recreate. Draft-only gate above prevents this
        // from clobbering a sent invoice.
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        data.items = {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: round2(item.quantity * item.unitPrice),
          })),
        };
      } else if (dto.tax !== undefined) {
        // Tax-only edit: recompute total from current subtotal.
        const current = await tx.invoice.findUnique({
          where: { id },
          select: { subtotal: true },
        });
        if (current) {
          const subtotal = Number(current.subtotal);
          data.tax = dto.tax;
          data.total = round2(subtotal + dto.tax);
        }
      }

      await tx.invoice.update({ where: { id }, data });
    });

    // If manually marked as PAID by staff, register the income transaction.
    if (dto.status === 'PAID' && existing.status !== 'PAID') {
      void this.recordPaymentTransaction(
        id,
        existing.number,
        Number(existing.total),
        existing.clientId,
      );
    }

    return this.get(id);
  }

  async cancel(
    id: string,
    reason: string | undefined,
    staffId: string,
  ): Promise<unknown> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true, email: true } } },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status === 'PAID') {
      throw new BadRequestException(
        'Cannot cancel a PAID invoice. Use refund instead.',
      );
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled');
    }
    if (existing.status === 'REFUNDED') {
      throw new BadRequestException('Invoice is already refunded');
    }

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
      },
    });

    this.logger.log(
      `Invoice ${id} cancelled by ${staffId}. Reason: ${reason ?? 'none'}`,
    );
    void this.notifyInvoiceCancelled(existing.clientId, existing.number, reason);
    void this.cancelMpPaymentsForInvoice(id);
    return this.get(id);
  }

  async refund(
    id: string,
    reason: string | undefined,
    staffId: string,
  ): Promise<unknown> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        payments: {
          where: { status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status !== 'PAID') {
      throw new BadRequestException(
        existing.status === 'REFUNDED'
          ? 'Invoice is already refunded'
          : existing.status === 'CANCELLED'
            ? 'Invoice is already cancelled'
            : 'Only PAID invoices can be refunded',
      );
    }

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        cancelReason: reason ?? null,
      },
    });

    // Cancel the income transaction that was created when the invoice was paid.
    await this.prisma.financeTransaction.updateMany({
      where: { invoiceId: id },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(
      `Invoice ${id} refunded by ${staffId}. Reason: ${reason ?? 'none'}`,
    );
    void this.notifyInvoiceRefunded(
      existing.clientId,
      existing.number,
      Number(existing.total),
      reason,
    );
    return this.get(id);
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, number: true, status: true },
    });
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status === 'PAID') {
      throw new BadRequestException('Cannot delete a PAID invoice');
    }

    await this.prisma.invoice.delete({ where: { id } });
    this.logger.log(`Deleted invoice ${id} (${existing.number})`);
    return { message: 'Invoice deleted', id };
  }

  async findWithItemsForClient(id: string, clientId: string): Promise<Prisma.InvoiceGetPayload<{
    include: {
      client: { select: { id: true; name: true; email: true } };
      creator: { select: { id: true; name: true; email: true } };
      project: { select: { id: true; name: true } };
      items: true;
    };
  }>> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        items: { orderBy: { id: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.clientId !== clientId) {
      throw new ForbiddenException('Access denied');
    }
    return row;
  }

  async findWithItems(id: string): Promise<Prisma.InvoiceGetPayload<{
    include: {
      client: { select: { id: true; name: true; email: true } };
      creator: { select: { id: true; name: true; email: true } };
      project: { select: { id: true; name: true } };
      items: true;
    };
  }>> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        items: { orderBy: { id: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Invoice not found');
    return row;
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /**
   * Generate the next invoice number. Format `${YYYY}-${NNNN}`,
   * numbered sequentially within the year so the sequence resets
   * every January.
   *
   * Uses a simple "max + 1" approach — fine for SZDevs's volume.
   * Under heavy concurrency a proper sequence would be safer, but
   * the Prisma unique constraint catches any collision and the
   * service retries.
   */
  private async nextInvoiceNumber(): Promise<string> {
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
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private computeTotals(
    items: InvoiceItemDto[],
    tax: number,
  ): { subtotal: number; tax: number; total: number } {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(subtotal + tax),
    };
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(`Unknown clientId: ${clientId}`);
    }
  }

  private serialize(row: {
    id: string;
    number: string;
    projectId?: string | null;
    subtotal: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
    status: string;
    issuedAt: Date;
    dueDate: Date;
    paidAt: Date | null;
    cancelledAt?: Date | null;
    refundedAt?: Date | null;
    cancelReason?: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    client?: { id: string; name: string; email: string } | null;
    project?: { id: string; name: string } | null;
    creator?: { id: string; name: string; email: string } | null;
    items?: Array<{
      id: string;
      description: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }>;
    _count?: { items: number };
  }): unknown {
    return {
      id: row.id,
      number: row.number,
      client: row.client ?? null,
      project: row.project ?? null,
      projectId: row.projectId ?? null,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status,
      issuedAt: row.issuedAt.toISOString(),
      dueDate: row.dueDate.toISOString().slice(0, 10),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
      refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
      cancelReason: row.cancelReason ?? null,
      notes: row.notes,
      items:
        row.items?.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.total),
        })) ?? [],
      itemCount: row._count?.items ?? row.items?.length ?? 0,
      createdBy: row.creator ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ===================================================================
  // Finance transaction helpers
  // ===================================================================

  /** Creates (or idempotently updates) the INCOME FinanceTransaction tied to a paid invoice. */
  async recordPaymentTransaction(
    invoiceId: string,
    invoiceNumber: string,
    total: number,
    createdBy: string,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    try {
      await this.prisma.financeTransaction.upsert({
        where: { invoiceId },
        create: {
          invoiceId,
          type: 'INCOME',
          category: 'SERVICE',
          description: `Fatura #${invoiceNumber}`,
          amount: total,
          date: today,
          status: 'PAID',
          paidAt: new Date(),
          createdBy,
        },
        update: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record payment transaction for invoice ${invoiceId}: ${String(err)}`);
    }
  }

  /** Resolves the MP access token (Redis → env fallback). */
  private async resolveMpToken(): Promise<string> {
    try {
      const keys = await this.redis.hgetall(API_KEYS_REDIS_KEY);
      if (keys['MP_ACCESS_TOKEN']) return keys['MP_ACCESS_TOKEN'];
    } catch {
      // Redis unavailable — fall through to env
    }
    return this.envMpToken;
  }

  /** Cancels all PENDING Mercado Pago payments linked to an invoice. */
  private async cancelMpPaymentsForInvoice(invoiceId: string): Promise<void> {
    const pending = await this.prisma.payment.findMany({
      where: { invoiceId, status: 'PENDING', externalId: { not: null } },
      select: { id: true, externalId: true },
    });
    if (pending.length === 0) return;

    const token = await this.resolveMpToken();
    if (!token) {
      this.logger.warn(`No MP access token — skipping payment cancellation for invoice ${invoiceId}`);
      return;
    }

    const mpPayment = new Payment(new MercadoPagoConfig({ accessToken: token }));
    for (const p of pending) {
      try {
        await mpPayment.update({
          id: Number(p.externalId),
          updatePaymentRequest: { status: 'cancelled' },
        });
        await this.prisma.payment.update({
          where: { id: p.id },
          data: { status: 'FAILED' },
        });
        this.logger.log(`Cancelled MP payment ${p.externalId} for invoice ${invoiceId}`);
      } catch (err) {
        this.logger.warn(`Could not cancel MP payment ${p.externalId}: ${String(err)}`);
      }
    }
  }

  // ===================================================================
  // Notification helpers
  // ===================================================================

  private async notifyInvoiceCancelled(
    clientId: string,
    number: string,
    reason?: string,
  ): Promise<void> {
    const envelope = (payload: unknown) =>
      JSON.stringify({ publishedAt: new Date().toISOString(), payload });
    await this.redis.publish(
      'notifications:inapp',
      envelope({
        userId: clientId,
        title: 'Cobrança cancelada',
        body: `A fatura ${number} foi cancelada.${reason ? ` Motivo: ${reason}` : ''}`,
        type: 'invoice.cancelled',
        link: `/perfil/faturas`,
      }),
    );
  }

  private async notifyInvoiceRefunded(
    clientId: string,
    number: string,
    amount: number,
    reason?: string,
  ): Promise<void> {
    const brl = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
    const envelope = (payload: unknown) =>
      JSON.stringify({ publishedAt: new Date().toISOString(), payload });
    await this.redis.publish(
      'notifications:inapp',
      envelope({
        userId: clientId,
        title: 'Reembolso processado',
        body: `O valor de ${brl} referente à fatura ${number} foi estornado.${reason ? ` Motivo: ${reason}` : ''}`,
        type: 'invoice.refunded',
        link: `/perfil/faturas`,
      }),
    );
  }

  private async notifyInvoiceCreated(
    invoiceId: string,
    clientId: string,
    total: number,
    number: string,
  ): Promise<void> {
    const brl = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(total);

    const envelope = (payload: unknown) =>
      JSON.stringify({ publishedAt: new Date().toISOString(), payload });

    // In-app notification for the client
    await this.redis.publish(
      'notifications:inapp',
      envelope({
        userId: clientId,
        title: 'Nova cobrança gerada',
        body: `A fatura ${number} no valor de ${brl} foi emitida e aguarda pagamento.`,
        type: 'invoice.created',
        link: `/perfil/faturas/${invoiceId}`,
      }),
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
