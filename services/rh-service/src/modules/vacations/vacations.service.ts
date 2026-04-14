import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

import type { CreateVacationDto } from './dto/create-vacation.dto';
import type { QueryVacationsDto } from './dto/query-vacations.dto';
import type { RejectVacationDto } from './dto/reject-vacation.dto';
import type {
  PaginatedVacations,
  VacationActionResponse,
  VacationItem,
} from './dto/vacation-response.dto';

/** Permission keys used for runtime branching inside the service. */
const PERM_APPROVE = 'rh:vacations:approve';

/** Redis channels consumed by notification-service. */
const EVENT_APPROVED = 'rh:vacation:approved';
const EVENT_REJECTED = 'rh:vacation:rejected';

/**
 * Statuses that block a new overlapping request. CANCELLED and
 * REJECTED requests don't reserve dates, so we don't count them.
 */
const BLOCKING_STATUSES = ['PENDING', 'APPROVED'] as const;

/**
 * Prisma include shared by every fetch path so the response mapper
 * can assume the nested shape.
 */
const VACATION_INCLUDE = {
  employee: { select: { id: true, name: true, email: true, userId: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.VacationRequestInclude;

type VacationWithRelations = Prisma.VacationRequestGetPayload<{
  include: typeof VACATION_INCLUDE;
}>;

@Injectable()
export class VacationsService {
  private readonly logger = new Logger(VacationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly permissions: PermissionResolverService,
  ) {}

  // ===================================================================
  // List + pagination (with overlap-aware date filter)
  // ===================================================================

  async list(query: QueryVacationsDto): Promise<PaginatedVacations> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.VacationRequestWhereInput = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;

    // Date range filter: return requests whose [startDate, endDate]
    // INTERSECTS the [from, to] window. A request intersects iff
    // `startDate <= to AND endDate >= from`.
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      if (from && to) {
        where.AND = [
          { startDate: { lte: to } },
          { endDate: { gte: from } },
        ];
      } else if (from) {
        where.endDate = { gte: from };
      } else if (to) {
        where.startDate = { lte: to };
      }
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vacationRequest.count({ where }),
      this.prisma.vacationRequest.findMany({
        where,
        include: VACATION_INCLUDE,
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  // ===================================================================
  // Detail
  // ===================================================================

  async get(id: string): Promise<VacationItem> {
    const row = await this.prisma.vacationRequest.findUnique({
      where: { id },
      include: VACATION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Vacation request not found');
    return this.toItem(row);
  }

  // ===================================================================
  // Create — the core of the module
  // ===================================================================

  async create(
    dto: CreateVacationDto,
    requesterUserId: string,
  ): Promise<VacationItem> {
    // ---- 1. Parse + validate the date window ----
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    // ---- 2. Employee exists? ----
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, userId: true, status: true, email: true, name: true },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }
    if (employee.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot create a vacation request for an inactive employee',
      );
    }

    // ---- 3. Ownership / approver authorization ----
    // A user can always create vacation requests for their own
    // employee record. Creating on behalf of someone else requires
    // `rh:vacations:approve` (an approver creating a retroactive
    // entry, for example).
    if (employee.userId !== requesterUserId) {
      const canApprove = await this.permissions.hasAll(requesterUserId, PERM_APPROVE);
      if (!canApprove) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'NotYourEmployee',
          message:
            'You can only create vacation requests for your own employee record, or with rh:vacations:approve for others.',
        });
      }
    }

    // ---- 4. Overlap check ----
    await this.ensureNoOverlap(employee.id, startDate, endDate);

    // ---- 5. Compute days (excluding weekends) ----
    const daysCount = this.calculateBusinessDays(startDate, endDate);
    if (daysCount === 0) {
      throw new BadRequestException(
        'The selected range contains zero business days',
      );
    }

    // ---- 6. Persist ----
    const row = await this.prisma.vacationRequest.create({
      data: {
        employeeId: employee.id,
        type: dto.type,
        startDate,
        endDate,
        daysCount,
        status: 'PENDING',
        notes: dto.notes ?? null,
      },
      include: VACATION_INCLUDE,
    });

    this.logger.log(
      `Created vacation request ${row.id} for ${employee.email} (${daysCount} day(s), ${dto.type})`,
    );
    return this.toItem(row);
  }

  // ===================================================================
  // Approve
  // ===================================================================

  async approve(
    id: string,
    reviewerUserId: string,
  ): Promise<VacationActionResponse> {
    const existing = await this.loadForAction(id);
    if (existing.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot approve a request in status ${existing.status}`,
      );
    }

    const reviewer = await this.resolveReviewer(reviewerUserId);

    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: reviewer?.id ?? null,
        rejectionReason: null,
      },
      include: VACATION_INCLUDE,
    });

    this.logger.log(
      `Approved vacation request ${id} for ${updated.employee.email}`,
    );

    // Fire-and-forget event publish. Redis errors are swallowed by
    // RedisService so a broker hiccup doesn't break the HTTP response.
    void this.redis.publish(EVENT_APPROVED, {
      vacationId: updated.id,
      employee: {
        id: updated.employee.id,
        email: updated.employee.email,
        name: updated.employee.name,
      },
      type: updated.type,
      startDate: updated.startDate.toISOString().slice(0, 10),
      endDate: updated.endDate.toISOString().slice(0, 10),
      daysCount: updated.daysCount,
      reviewedBy: updated.reviewedBy
        ? { id: updated.reviewedBy.id, name: updated.reviewedBy.name }
        : null,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    });

    return {
      message: 'Vacation request approved',
      vacation: this.toItem(updated),
    };
  }

  // ===================================================================
  // Reject
  // ===================================================================

  async reject(
    id: string,
    dto: RejectVacationDto,
    reviewerUserId: string,
  ): Promise<VacationActionResponse> {
    const existing = await this.loadForAction(id);
    if (existing.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot reject a request in status ${existing.status}`,
      );
    }

    const reviewer = await this.resolveReviewer(reviewerUserId);

    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: reviewer?.id ?? null,
        rejectionReason: dto.reason,
      },
      include: VACATION_INCLUDE,
    });

    this.logger.log(
      `Rejected vacation request ${id} for ${updated.employee.email}: ${dto.reason}`,
    );

    void this.redis.publish(EVENT_REJECTED, {
      vacationId: updated.id,
      employee: {
        id: updated.employee.id,
        email: updated.employee.email,
        name: updated.employee.name,
      },
      type: updated.type,
      startDate: updated.startDate.toISOString().slice(0, 10),
      endDate: updated.endDate.toISOString().slice(0, 10),
      daysCount: updated.daysCount,
      rejectionReason: updated.rejectionReason,
      reviewedBy: updated.reviewedBy
        ? { id: updated.reviewedBy.id, name: updated.reviewedBy.name }
        : null,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    });

    return {
      message: 'Vacation request rejected',
      vacation: this.toItem(updated),
    };
  }

  // ===================================================================
  // Cancel (DELETE /vacations/:id)
  //
  // Cancelling is idempotent: doing it twice is fine. Only the
  // requester OR a user with `rh:vacations:approve` can cancel,
  // and only while the request is still PENDING.
  // ===================================================================

  async cancel(id: string, requesterUserId: string): Promise<VacationActionResponse> {
    const row = await this.loadForAction(id);

    if (row.status !== 'PENDING') {
      throw new ConflictException(
        `Only PENDING requests can be cancelled (current: ${row.status})`,
      );
    }

    const isOwner = row.employee.userId === requesterUserId;
    if (!isOwner) {
      const canApprove = await this.permissions.hasAll(requesterUserId, PERM_APPROVE);
      if (!canApprove) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'CannotCancel',
          message:
            'You can only cancel your own PENDING requests unless you hold rh:vacations:approve.',
        });
      }
    }

    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        reviewedAt: new Date(),
      },
      include: VACATION_INCLUDE,
    });

    return {
      message: 'Vacation request cancelled',
      vacation: this.toItem(updated),
    };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  /**
   * Reject a new request whose [startDate, endDate] window intersects
   * an existing PENDING or APPROVED request for the same employee.
   * REJECTED / CANCELLED requests are ignored — they don't hold the
   * employee's calendar hostage.
   */
  private async ensureNoOverlap(
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const overlap = await this.prisma.vacationRequest.findFirst({
      where: {
        employeeId,
        status: { in: BLOCKING_STATUSES as unknown as Prisma.EnumVacationRequestStatusFilter['in'] },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
      select: { id: true, startDate: true, endDate: true, status: true },
    });
    if (overlap) {
      throw new ConflictException({
        statusCode: 409,
        error: 'VacationOverlap',
        message: `Overlaps with ${overlap.status.toLowerCase()} request from ${overlap.startDate
          .toISOString()
          .slice(0, 10)} to ${overlap.endDate.toISOString().slice(0, 10)}`,
        conflictingRequestId: overlap.id,
      });
    }
  }

  /**
   * Count weekdays between two dates, inclusive. Uses UTC so a
   * request that spans a DST boundary doesn't end up with an extra
   * or missing day.
   */
  private calculateBusinessDays(start: Date, end: Date): number {
    const startUtc = Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    );
    const endUtc = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    );
    if (endUtc < startUtc) return 0;

    let count = 0;
    // Walk day-by-day. Ranges in practice are at most a few weeks, so
    // this is cheap enough to do in JS without a date library.
    for (let cursor = startUtc; cursor <= endUtc; cursor += 24 * 60 * 60 * 1000) {
      const day = new Date(cursor).getUTCDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  /**
   * Fetch a row with relations, 404 if missing. Shared between the
   * three action handlers (approve, reject, cancel) so the lookup
   * code + 404 flow lives in one place.
   */
  private async loadForAction(id: string): Promise<VacationWithRelations> {
    const row = await this.prisma.vacationRequest.findUnique({
      where: { id },
      include: VACATION_INCLUDE,
    });
    if (!row) throw new NotFoundException('Vacation request not found');
    return row;
  }

  /**
   * Map the authenticated user (via their User.id) to the Employee row
   * whose `userId` matches. Returns `null` if no employee record is
   * linked — in that case the reviewer still gets to act, their
   * identity is just not stamped on the row.
   */
  private async resolveReviewer(
    reviewerUserId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.employee.findUnique({
      where: { userId: reviewerUserId },
      select: { id: true },
    });
  }

  private toItem(row: VacationWithRelations): VacationItem {
    return {
      id: row.id,
      employee: {
        id: row.employee.id,
        name: row.employee.name,
        email: row.employee.email,
      },
      type: row.type,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      daysCount: row.daysCount,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
      reviewedBy: row.reviewedBy
        ? {
            id: row.reviewedBy.id,
            name: row.reviewedBy.name,
            email: row.reviewedBy.email,
          }
        : null,
      notes: row.notes,
      rejectionReason: row.rejectionReason,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
