import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuditExportDto,
  AuditQueryDto,
} from './dto/audit-query.dto';
import type { AuditLogInput } from './dto/audit-log.dto';
import type {
  AuditLogItem,
  PaginatedAuditResponse,
} from './dto/audit-response.dto';
import type { QueryAuditDto } from './dto/query-audit.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_CURSOR_PAGE_SIZE = 50;
const MAX_EXPORT_ROWS = 50_000;
const SECURITY_FAILED_LOGINS_THRESHOLD = 5;
const SECURITY_FORBIDDEN_THRESHOLD = 10;
const SECURITY_OLD_SESSION_DAYS = 30;
const SECURITY_LOOKBACK_HOURS = 24;

/** Cursor-paginated response for `GET /audit/logs`. */
export interface AuditCursorPage {
  items: AuditLogItem[];
  /** Pass back as `?cursor=` to fetch the next page; `null` when exhausted. */
  nextCursor: string | null;
  pageSize: number;
}

export interface AuditStats {
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string | null; count: number }>;
  modulesWithErrors: Array<{ module: string; errors: number }>;
  loginsByHour: Array<{ hour: string; count: number }>;
}

export interface UserTimelineItem extends AuditLogItem {}

export interface SecurityReport {
  failedLoginIps: Array<{ ipAddress: string; failures: number; lastAttemptAt: string }>;
  usersWithManyForbidden: Array<{ userId: string; forbidden: number }>;
  oldSessions: Array<{
    sessionId: string;
    userId: string;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastSeenAt: string | null;
  }>;
}

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

  // ---------------------------------------------------------------------
  // New global-audit query surface (cursor-paginated, used by /audit/*).
  //
  // Cursor pagination explained:
  //   - Frontend asks for the first page WITHOUT `cursor`. The query
  //     orders by `createdAt DESC, id DESC` (id is a tiebreaker so two
  //     rows with the same millisecond don't repeat) and `take`s
  //     pageSize+1 rows.
  //   - We slice off the first pageSize rows; the extra row's `id`
  //     becomes `nextCursor`. If there's no extra row, we return
  //     `nextCursor: null`.
  //   - Subsequent calls pass back `?cursor=<id>`. Prisma's `cursor:`
  //     option seeks the index directly (no OFFSET, no full table
  //     scan). We pair it with `skip: 1` so the cursor row itself
  //     isn't returned twice.
  //
  // The audit table has a `createdAt` index; combined with the index
  // on `id` (the PK), the seek stays O(log n) regardless of how deep
  // the user paginates. Compare with `skip: page * pageSize`, which
  // forces Postgres to scan and discard `page * pageSize` rows for
  // every request — fine for page 1, prohibitive at page 5,000.
  // ---------------------------------------------------------------------

  async cursorQuery(q: AuditQueryDto): Promise<AuditCursorPage> {
    const pageSize = q.pageSize ?? DEFAULT_CURSOR_PAGE_SIZE;
    const where = this.buildWhere(q);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize + 1,
      ...(q.cursor
        ? { cursor: { id: q.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = rows.length > pageSize;
    const page = hasMore ? rows.slice(0, pageSize) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    return {
      items: page.map(this.toAuditItem),
      nextCursor,
      pageSize,
    };
  }

  /** Streamed-friendly export. Returns rows in chronological order, capped to MAX_EXPORT_ROWS. */
  async exportRows(q: AuditExportDto): Promise<AuditLogItem[]> {
    const where = this.buildWhere({
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      userId: q.userId,
      module: q.module,
      action: q.action,
      ipAddress: q.ipAddress,
    });
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_EXPORT_ROWS,
    });
    return rows.map(this.toAuditItem);
  }

  /**
   * Aggregate stats over the last 7 days. We use Prisma's `groupBy`
   * for the action/user/module rollups (one query per dimension) and
   * a raw SQL date-trunc for the per-hour login series — Prisma's
   * groupBy can't bucket by date_trunc('hour', ...) yet.
   */
  async stats(): Promise<AuditStats> {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [topActionsRaw, topUsersRaw, errorsRaw, loginsRaw] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: since }, userId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),
      this.prisma.auditLog.groupBy({
        by: ['module'],
        where: {
          createdAt: { gte: since },
          OR: [
            { action: { contains: 'FAILED' } },
            { action: { contains: 'BLOCKED' } },
            { action: { contains: 'DENIED' } },
            { action: { contains: 'ERROR' } },
          ],
        },
        _count: { _all: true },
        orderBy: { _count: { module: 'desc' } },
      }),
      this.prisma.$queryRaw<Array<{ hour: Date; count: bigint }>>`
        SELECT date_trunc('hour', "createdAt") AS hour,
               COUNT(*)::bigint                AS count
        FROM   "audit_logs"
        WHERE  "createdAt" >= ${since}
        AND    "action" = 'LOGIN_SUCCESS'
        GROUP  BY 1
        ORDER  BY 1 ASC
      `,
    ]);

    return {
      topActions: topActionsRaw.map((r) => ({ action: r.action, count: r._count._all })),
      topUsers: topUsersRaw.map((r) => ({ userId: r.userId, count: r._count._all })),
      modulesWithErrors: errorsRaw.map((r) => ({ module: r.module, errors: r._count._all })),
      loginsByHour: loginsRaw.map((r) => ({
        hour: r.hour.toISOString(),
        count: Number(r.count),
      })),
    };
  }

  /** Full timeline of a user's actions. Capped at 1000 newest rows. */
  async userTimeline(userId: string): Promise<UserTimelineItem[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return rows.map(this.toAuditItem);
  }

  /**
   * Security report — surfaces three classes of risk:
   *   1. IPs racking up failed-login attempts (potential brute force)
   *   2. Users hitting many forbidden routes (privilege probing)
   *   3. Sessions older than 30 days (stale tokens to revoke)
   *
   * Run from `GET /audit/security-report`, gated by `dev:config:edit`.
   */
  async securityReport(): Promise<SecurityReport> {
    const lookback = new Date(Date.now() - SECURITY_LOOKBACK_HOURS * 60 * 60 * 1000);
    const oldSessionThreshold = new Date(
      Date.now() - SECURITY_OLD_SESSION_DAYS * 24 * 60 * 60 * 1000,
    );

    const [failedLoginsRaw, forbiddenRaw, oldSessionsRaw] = await Promise.all([
      // 1. Failed-login attempts grouped by IP, last 24h.
      this.prisma.$queryRaw<
        Array<{ ipAddress: string; failures: bigint; last_attempt_at: Date }>
      >`
        SELECT "ipAddress",
               COUNT(*)::bigint           AS failures,
               MAX("createdAt")           AS last_attempt_at
        FROM   "audit_logs"
        WHERE  "createdAt" >= ${lookback}
        AND    "action" IN ('LOGIN_FAILED','LOGIN_BLOCKED')
        AND    "ipAddress" IS NOT NULL
        GROUP  BY "ipAddress"
        HAVING COUNT(*) >= ${SECURITY_FAILED_LOGINS_THRESHOLD}
        ORDER  BY failures DESC
        LIMIT  50
      `,
      // 2. Users hitting many 403s in the last 24h. We treat anything
      //    matching FORBIDDEN/PERMISSION_DENIED as a forbidden hit.
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: lookback },
          userId: { not: null },
          OR: [
            { action: { contains: 'FORBIDDEN' } },
            { action: { contains: 'DENIED' } },
            { action: { contains: 'UNAUTHORIZED' } },
          ],
        },
        _count: { _all: true },
        having: { userId: { _count: { gte: SECURITY_FORBIDDEN_THRESHOLD } } },
        orderBy: { _count: { userId: 'desc' } },
        take: 50,
      }),
      // 3. Sessions older than 30 days, still active (revokedAt is null).
      // The Session model doesn't carry a `lastUsedAt` column today —
      // when that gets added, surface it in `lastSeenAt` below.
      this.prisma.session.findMany({
        where: {
          revokedAt: null,
          createdAt: { lt: oldSessionThreshold },
        },
        select: {
          id: true,
          userId: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          user: { select: { email: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
    ]);

    return {
      failedLoginIps: failedLoginsRaw.map((r) => ({
        ipAddress: r.ipAddress,
        failures: Number(r.failures),
        lastAttemptAt: r.last_attempt_at.toISOString(),
      })),
      usersWithManyForbidden: forbiddenRaw
        .filter((r): r is typeof r & { userId: string } => r.userId !== null)
        .map((r) => ({ userId: r.userId, forbidden: r._count._all })),
      oldSessions: oldSessionsRaw.map((s) => ({
        sessionId: s.id,
        userId: s.userId,
        userEmail: s.user?.email ?? null,
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt.toISOString(),
        // Schema doesn't track last-seen yet; fold to null so the
        // response shape stays stable when that column is added.
        lastSeenAt: null,
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------

  private buildWhere(
    q: Pick<AuditQueryDto, 'dateFrom' | 'dateTo' | 'userId' | 'module' | 'action' | 'ipAddress'>,
  ): Prisma.AuditLogWhereInput {
    const toDate = q.dateTo.length === 10
      ? new Date(`${q.dateTo}T23:59:59.999Z`)
      : new Date(q.dateTo);
    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: new Date(q.dateFrom),
        lte: toDate,
      },
    };
    if (q.userId) where.userId = q.userId;
    if (q.action) where.action = q.action;
    if (q.module) where.module = q.module as Prisma.AuditLogWhereInput['module'];
    if (q.ipAddress) where.ipAddress = q.ipAddress;
    return where;
  }

  private toAuditItem = (row: {
    id: string;
    userId: string | null;
    action: string;
    module: string;
    resourceId: string | null;
    meta: unknown;
    ipAddress: string | null;
    createdAt: Date;
  }): AuditLogItem => ({
    id: row.id,
    userId: row.userId,
    action: row.action,
    module: row.module,
    resourceId: row.resourceId,
    meta: (row.meta ?? {}) as Record<string, unknown>,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt.toISOString(),
  });
}
