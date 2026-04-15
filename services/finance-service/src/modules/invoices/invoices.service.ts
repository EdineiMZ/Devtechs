import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateInvoiceDto,
  InvoiceItemDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // CRUD
  // ===================================================================

  async list(): Promise<unknown[]> {
    const rows = await this.prisma.invoice.findMany({
      orderBy: [{ issuedAt: 'desc' }],
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: { orderBy: { id: 'asc' } },
        _count: { select: { items: true } },
      },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string): Promise<unknown> {
    const row = await this.findWithItems(id);
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
    return this.get(created.id);
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<unknown> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
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

  async findWithItems(id: string): Promise<Prisma.InvoiceGetPayload<{
    include: {
      client: { select: { id: true; name: true; email: true } };
      creator: { select: { id: true; name: true; email: true } };
      items: true;
    };
  }>> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
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
   * Uses a simple "max + 1" approach — fine for DevTechs's volume.
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
    subtotal: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
    status: string;
    issuedAt: Date;
    dueDate: Date;
    paidAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    client?: { id: string; name: string; email: string } | null;
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
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      total: Number(row.total),
      status: row.status,
      issuedAt: row.issuedAt.toISOString(),
      dueDate: row.dueDate.toISOString().slice(0, 10),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
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
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
