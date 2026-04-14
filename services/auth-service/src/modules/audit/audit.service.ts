import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type { AuditLogInput } from './dto/audit-log.dto';
import type {
  AuditLogItem,
  PaginatedAuditResponse,
} from './dto/audit-response.dto';
import type { QueryAuditDto } from './dto/query-audit.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------

  /**
   * Persist an audit record. Best-effort: any failure is swallowed and
   * logged so that the caller's user-facing request isn't broken by a
   * DB hiccup on the audit path.
   *
   * Call this from services, interceptors, or guards — anywhere you
   * have enough context to describe an action.
   */
  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          // Prisma expects the enum literal; cast because the DTO uses
          // a plain string so the HTTP layer stays decoupled.
          module: (input.module ?? 'AUTH') as Prisma.AuditLogCreateInput['module'],
          resourceId: input.resourceId ?? null,
          meta: (input.meta ?? {}) as Prisma.InputJsonValue,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to write audit log [${input.action}]: ${reason}`,
      );
    }
  }

  // -------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------

  async query(q: QueryAuditDto): Promise<PaginatedAuditResponse> {
    const page = q.page ?? DEFAULT_PAGE;
    const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.AuditLogWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    if (q.module) {
      where.module = q.module as Prisma.AuditLogWhereInput['module'];
    }
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    // Parallel count + page fetch. $transaction guarantees both see the
    // same snapshot, so total and items stay consistent when new rows
    // are being written concurrently.
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: AuditLogItem[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      action: row.action,
      module: row.module,
      resourceId: row.resourceId,
      meta: (row.meta ?? {}) as Record<string, unknown>,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }
}
