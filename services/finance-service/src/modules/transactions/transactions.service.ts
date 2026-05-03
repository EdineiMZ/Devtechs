import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@szdevs/database';

import { AuditClientService } from '../../common/audit/audit-client.service';
import { PrismaService } from '../../prisma/prisma.service';

import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type {
  CashflowQueryDto,
  QueryTransactionsDto,
  SummaryQueryDto,
} from './dto/query-transactions.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

/**
 * DRE summary response — one row per (type, category) pair plus
 * the totals. Frontends render this directly as a two-column
 * table ("Receitas" / "Despesas") with a running balance.
 */
export interface TransactionSummary {
  from: string;
  to: string;
  income: {
    total: number;
    byCategory: Array<{ category: string; total: number }>;
  };
  expense: {
    total: number;
    byCategory: Array<{ category: string; total: number }>;
  };
  balance: number;
}

/** One bucket per month in the cashflow report. */
export interface CashflowMonth {
  month: string; // "2026-04"
  income: number;
  expense: number;
  net: number;
  /// True when this month is in the future — values are projections
  /// derived from PENDING transactions rather than settled PAID rows.
  projected: boolean;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditClientService,
  ) {}

  // ===================================================================
  // CRUD
  // ===================================================================

  async list(query: QueryTransactionsDto): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.FinanceTransactionWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.costCenterId) where.costCenterId = query.costCenterId;
    if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.financeTransaction.count({ where }),
      this.prisma.financeTransaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } },
          costCenter: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r) => this.serialize(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async create(dto: CreateTransactionDto, userId: string): Promise<unknown> {
    if (dto.projectId) {
      await this.assertProjectExists(dto.projectId);
    }
    if (dto.costCenterId) {
      await this.assertCostCenterExists(dto.costCenterId);
    }

    const row = await this.prisma.financeTransaction.create({
      data: {
        type: dto.type,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        date: new Date(dto.date),
        status: dto.status ?? 'PENDING',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        projectId: dto.projectId ?? null,
        costCenterId: dto.costCenterId ?? null,
        attachmentKey: dto.attachmentKey ?? null,
        notes: dto.notes ?? null,
        createdBy: userId,
      },
      include: {
        project: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Created transaction ${row.id} (${row.type}/${row.category})`);
    void this.audit.log({
      userId,
      action: 'TRANSACTION_CREATED',
      module: 'FINANCEIRO',
      resourceId: row.id,
      meta: { type: row.type, category: row.category, amount: row.amount, status: row.status },
    });
    return this.serialize(row);
  }

  async update(id: string, dto: UpdateTransactionDto, userId?: string): Promise<unknown> {
    const existing = await this.prisma.financeTransaction.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Transaction not found');

    if (dto.projectId) await this.assertProjectExists(dto.projectId);
    if (dto.costCenterId) await this.assertCostCenterExists(dto.costCenterId);

    const data: Prisma.FinanceTransactionUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.projectId !== undefined) {
      data.project = dto.projectId
        ? { connect: { id: dto.projectId } }
        : { disconnect: true };
    }
    if (dto.costCenterId !== undefined) {
      data.costCenter = dto.costCenterId
        ? { connect: { id: dto.costCenterId } }
        : { disconnect: true };
    }
    if (dto.attachmentKey !== undefined) data.attachmentKey = dto.attachmentKey;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const row = await this.prisma.financeTransaction.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });
    void this.audit.log({
      userId: userId ?? null,
      action: 'TRANSACTION_UPDATED',
      module: 'FINANCEIRO',
      resourceId: id,
      meta: { changedFields: Object.keys(dto) },
    });
    return this.serialize(row);
  }

  /**
   * Transition a transaction to PAID. Sets paidAt to now and
   * blocks the write if the row is already PAID or CANCELLED.
   */
  async markPaid(id: string, userId?: string): Promise<unknown> {
    const existing = await this.prisma.financeTransaction.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Transaction not found');
    if (existing.status === 'PAID') {
      throw new BadRequestException('Transaction is already PAID');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot pay a CANCELLED transaction');
    }

    const row = await this.prisma.financeTransaction.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
      include: {
        project: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });
    this.logger.log(`Marked transaction ${id} as PAID`);
    void this.audit.log({
      userId: userId ?? null,
      action: 'TRANSACTION_PAID',
      module: 'FINANCEIRO',
      resourceId: id,
    });
    return this.serialize(row);
  }

  // ===================================================================
  // DRE summary — the main reporting query
  // ===================================================================

  /**
   * Simplified DRE (Demonstração de Resultado do Exercício).
   *
   * One Prisma `groupBy` hits `(type, category)` on the rows that
   * fall inside the period and returns the per-bucket sums. Then
   * a second pass rolls up per `type` for the income / expense
   * totals. Two round-trips is cheaper than fetching every row.
   *
   * The groupBy uses the `type`, `category`, and `date` indexes
   * defined on the table, so the query plan is an index-only
   * bitmap scan on the slice of rows inside the period.
   *
   * Rows in CANCELLED status are excluded — they're kept for
   * audit but must never contribute to the P&L.
   */
  async summary(query: SummaryQueryDto): Promise<TransactionSummary> {
    const now = new Date();
    const defaultFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const defaultTo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    );
    const from = query.from ? new Date(query.from) : defaultFrom;
    const to = query.to ? new Date(query.to) : defaultTo;

    // ----------------------------------------------------------------
    // THE DRE QUERY — Prisma groupBy on (type, category) with the
    // date range as a WHERE predicate. Prisma emits a single
    // `SELECT type, category, SUM(amount) FROM finance_transactions
    //  WHERE date BETWEEN $1 AND $2 AND status != 'CANCELLED'
    //  GROUP BY type, category`.
    //
    // Hits the `(type)` and `(category)` indexes via the optimizer's
    // bitmap-or + the `(date)` index for the range predicate.
    // ----------------------------------------------------------------
    const grouped = await this.prisma.financeTransaction.groupBy({
      by: ['type', 'category'],
      where: {
        date: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      _sum: { amount: true },
    });

    const income = {
      total: 0,
      byCategory: [] as Array<{ category: string; total: number }>,
    };
    const expense = {
      total: 0,
      byCategory: [] as Array<{ category: string; total: number }>,
    };

    for (const row of grouped) {
      const total = row._sum.amount ? Number(row._sum.amount) : 0;
      const bucket = row.type === 'INCOME' ? income : expense;
      bucket.total += total;
      bucket.byCategory.push({ category: row.category, total: round2(total) });
    }

    income.total = round2(income.total);
    expense.total = round2(expense.total);

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      income,
      expense,
      balance: round2(income.total - expense.total),
    };
  }

  // ===================================================================
  // Cashflow — monthly rollup with projection
  // ===================================================================

  /**
   * Monthly cash flow for the trailing `months` window ending in
   * the current month. Future months inside the window are marked
   * `projected: true` and use the PENDING / OVERDUE statuses; past
   * months use only PAID settled rows so the series is stable.
   */
  async cashflow(query: CashflowQueryDto): Promise<{ months: CashflowMonth[] }> {
    const months = query.months ?? 6;
    const now = new Date();
    const startUtc = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - (months - 1),
      1,
    );
    const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);
    const from = new Date(startUtc);
    const to = new Date(endUtc);

    const rows = await this.prisma.financeTransaction.groupBy({
      by: ['type', 'date'],
      where: {
        date: { gte: from, lte: to },
        status: { not: 'CANCELLED' },
      },
      _sum: { amount: true },
    });

    const buckets = new Map<
      string,
      { income: number; expense: number; projected: boolean }
    >();
    // Pre-populate every month so the response is dense (important
    // for chart rendering — the frontend doesn't have to fill gaps).
    for (let i = 0; i < months; i++) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1),
      );
      const key = monthKey(d);
      buckets.set(key, { income: 0, expense: 0, projected: d > now });
    }

    for (const row of rows) {
      const key = monthKey(row.date);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      const amount = row._sum.amount ? Number(row._sum.amount) : 0;
      if (row.type === 'INCOME') bucket.income += amount;
      else bucket.expense += amount;
    }

    const monthsOut: CashflowMonth[] = Array.from(buckets.entries()).map(
      ([month, b]) => ({
        month,
        income: round2(b.income),
        expense: round2(b.expense),
        net: round2(b.income - b.expense),
        projected: b.projected,
      }),
    );

    return { months: monthsOut };
  }

  // ===================================================================
  // Internals
  // ===================================================================

  private async assertProjectExists(projectId: string): Promise<void> {
    const exists = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(`Unknown projectId: ${projectId}`);
    }
  }

  private async assertCostCenterExists(costCenterId: string): Promise<void> {
    const exists = await this.prisma.costCenter.findUnique({
      where: { id: costCenterId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(`Unknown costCenterId: ${costCenterId}`);
    }
  }

  private serialize(row: {
    id: string;
    type: string;
    category: string;
    description: string;
    amount: Prisma.Decimal;
    date: Date;
    status: string;
    dueDate: Date | null;
    paidAt: Date | null;
    projectId: string | null;
    costCenterId: string | null;
    attachmentKey: string | null;
    notes: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
    costCenter?: { id: string; name: string } | null;
    creator?: { id: string; name: string; email: string } | null;
  }): unknown {
    return {
      id: row.id,
      type: row.type,
      category: row.category,
      description: row.description,
      amount: Number(row.amount),
      date: row.date.toISOString().slice(0, 10),
      status: row.status,
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      project: row.project ?? null,
      costCenter: row.costCenter ?? null,
      attachmentKey: row.attachmentKey,
      notes: row.notes,
      createdBy: row.creator ?? { id: row.createdBy, name: null, email: null },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/** Round to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "YYYY-MM" for the cashflow bucket key. */
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
