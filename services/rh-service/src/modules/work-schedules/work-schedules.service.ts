import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import type {
  WorkScheduleHistoryResponse,
  WorkScheduleItem,
} from './dto/work-schedule-response.dto';

interface WorkScheduleRow {
  id: string;
  employeeId: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  effectiveFrom: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Work schedule history, append-only.
 *
 * The model is intentionally immutable-log: a new schedule for an
 * employee is a new row, never an update to an existing one. That
 * gives HR a clean history ("what hours were we paying this person
 * on March 15th?") without a separate audit table.
 *
 * The "current" schedule for an employee is the one with the
 * greatest `effectiveFrom <= today`. The list endpoint surfaces
 * every schedule and marks the current one with `isCurrent: true`
 * so the UI doesn't have to recompute it.
 */
@Injectable()
export class WorkSchedulesService {
  private readonly logger = new Logger(WorkSchedulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // POST /work-schedule/:employeeId
  // ===================================================================

  async create(
    employeeId: string,
    dto: CreateWorkScheduleDto,
  ): Promise<WorkScheduleItem> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, status: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const effectiveFrom = new Date(dto.effectiveFrom);

    // The DB has a unique index on (employeeId, effectiveFrom) but
    // we check explicitly so the error message tells HR which
    // existing schedule collided instead of a generic P2002.
    const existing = await this.prisma.workSchedule.findUnique({
      where: {
        employeeId_effectiveFrom: {
          employeeId,
          effectiveFrom,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'ScheduleAlreadyExists',
        message: `A work schedule already exists for this employee starting ${dto.effectiveFrom}`,
        conflictingScheduleId: existing.id,
      });
    }

    const row = (await this.prisma.workSchedule.create({
      data: {
        employeeId,
        monday: dto.monday,
        tuesday: dto.tuesday,
        wednesday: dto.wednesday,
        thursday: dto.thursday,
        friday: dto.friday,
        saturday: dto.saturday,
        sunday: dto.sunday,
        effectiveFrom,
        notes: dto.notes ?? null,
      },
    })) as WorkScheduleRow;

    this.logger.log(
      `Created work schedule ${row.id} for employee ${employeeId} (effective ${dto.effectiveFrom})`,
    );

    return this.toItem(row, /* isCurrent */ this.computeIsCurrent(row.effectiveFrom, [row.effectiveFrom]));
  }

  // ===================================================================
  // GET /work-schedule/:employeeId
  // ===================================================================

  async list(employeeId: string): Promise<WorkScheduleHistoryResponse> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const rows = (await this.prisma.workSchedule.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    })) as WorkScheduleRow[];

    // Compute the "current" schedule once, then mark it inside the
    // list. `computeIsCurrent` picks the latest effectiveFrom that is
    // on or before today — subsequent rows are either future-dated
    // (not yet in effect) or older history.
    const today = this.todayUtc();
    const currentEffectiveFrom = rows
      .map((r) => r.effectiveFrom)
      .find((d) => d.getTime() <= today.getTime());

    return {
      employeeId,
      items: rows.map((r) =>
        this.toItem(
          r,
          currentEffectiveFrom !== undefined &&
            r.effectiveFrom.getTime() === currentEffectiveFrom.getTime(),
        ),
      ),
      total: rows.length,
    };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private computeIsCurrent(
    candidate: Date,
    allEffectiveFroms: Date[],
  ): boolean {
    const today = this.todayUtc();
    const sortedDesc = [...allEffectiveFroms].sort(
      (a, b) => b.getTime() - a.getTime(),
    );
    const winner = sortedDesc.find((d) => d.getTime() <= today.getTime());
    return (
      winner !== undefined && winner.getTime() === candidate.getTime()
    );
  }

  /** Today's date at UTC midnight. Mirrors the `@db.Date` semantics. */
  private todayUtc(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private toItem(row: WorkScheduleRow, isCurrent: boolean): WorkScheduleItem {
    const weeklyHours =
      row.monday +
      row.tuesday +
      row.wednesday +
      row.thursday +
      row.friday +
      row.saturday +
      row.sunday;

    return {
      id: row.id,
      employeeId: row.employeeId,
      monday: row.monday,
      tuesday: row.tuesday,
      wednesday: row.wednesday,
      thursday: row.thursday,
      friday: row.friday,
      saturday: row.saturday,
      sunday: row.sunday,
      weeklyHours,
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      isCurrent,
    };
  }
}
