import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateTaskDto } from './dto/create-task.dto';
import type { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import type { MoveTaskDto } from './dto/move-task.dto';
import type {
  CreateTimeEntryResponse,
  MoveTaskResponse,
  TaskDetail,
  TimeEntryDto,
} from './dto/task-response.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
  _count: { select: { subtasks: true, timeEntries: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // Create
  // ===================================================================

  async create(dto: CreateTaskDto): Promise<TaskDetail> {
    // Verify the project exists, plus pre-validate the FK fields so
    // we return clean 400s instead of raw P2025 errors.
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new BadRequestException('Unknown projectId');

    await this.assertUserExists('reporterId', dto.reporterId);
    if (dto.assigneeId) await this.assertUserExists('assigneeId', dto.assigneeId);

    if (dto.parentId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== dto.projectId) {
        throw new BadRequestException(
          'parentId must reference a task in the same project',
        );
      }
    }

    if (dto.sprintId) {
      const sprint = await this.prisma.sprint.findUnique({
        where: { id: dto.sprintId },
        select: { id: true, projectId: true },
      });
      if (!sprint || sprint.projectId !== dto.projectId) {
        throw new BadRequestException(
          'sprintId must reference a sprint in the same project',
        );
      }
    }

    // Resolve the target column. Caller can pass one explicitly; if
    // not, default to the first column on the project's primary board.
    const columnId = await this.resolveTargetColumn(dto.projectId, dto.columnId);

    // Append at the end of the column. Computing max(order) + 1 is
    // a single index range scan thanks to the (columnId, order) index.
    const lastOrder = await this.prisma.task.findFirst({
      where: { columnId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (lastOrder?.order ?? -1) + 1;

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        columnId,
        sprintId: dto.sprintId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        type: dto.type ?? 'TASK',
        priority: dto.priority ?? 'MEDIUM',
        status: 'TODO',
        reporterId: dto.reporterId,
        assigneeId: dto.assigneeId ?? null,
        estimatedHours: dto.estimatedHours ?? null,
        loggedHours: 0,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order,
        labels: dto.labels ?? [],
        parentId: dto.parentId ?? null,
      },
      include: TASK_INCLUDE,
    });

    this.logger.log(`Created task ${task.id} in column ${columnId} (order ${order})`);
    return this.toDetail(task);
  }

  // ===================================================================
  // Update (general — also handles column changes)
  // ===================================================================

  async update(id: string, dto: UpdateTaskDto): Promise<TaskDetail> {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true, projectId: true, columnId: true },
    });
    if (!existing) throw new NotFoundException('Task not found');

    if (dto.assigneeId) await this.assertUserExists('assigneeId', dto.assigneeId);

    if (dto.parentId) {
      const parent = await this.prisma.task.findUnique({
        where: { id: dto.parentId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== existing.projectId) {
        throw new BadRequestException(
          'parentId must reference a task in the same project',
        );
      }
      if (dto.parentId === id) {
        throw new BadRequestException('A task cannot be its own parent');
      }
    }

    if (dto.columnId && dto.columnId !== existing.columnId) {
      // The caller is moving columns through the generic update.
      // We delegate to moveToColumn() so the order recalculation
      // logic lives in exactly one place.
      await this.moveToColumn(id, {
        targetColumnId: dto.columnId,
        newOrder: 0,
      });
    }

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.estimatedHours !== undefined) {
      data.estimatedHours = dto.estimatedHours;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.labels !== undefined) data.labels = dto.labels;
    if (dto.assigneeId !== undefined) {
      data.assignee = dto.assigneeId
        ? { connect: { id: dto.assigneeId } }
        : { disconnect: true };
    }
    if (dto.sprintId !== undefined) {
      data.sprint = dto.sprintId
        ? { connect: { id: dto.sprintId } }
        : { disconnect: true };
    }
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
      include: TASK_INCLUDE,
    });
    return this.toDetail(updated);
  }

  // ===================================================================
  // Move to column (drag-and-drop)
  //
  // The hairy bit: moving a task across columns has to renumber
  // BOTH the source column (closing the gap) and the destination
  // column (making room at the new position). We do every write in
  // one $transaction so concurrent drags can't corrupt the order
  // sequence.
  //
  // Same-column reorders take a fast path: only the affected slice
  // between old and new positions is renumbered.
  // ===================================================================

  async moveToColumn(taskId: string, dto: MoveTaskDto): Promise<MoveTaskResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        columnId: true,
        order: true,
        column: { select: { id: true, boardId: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    const targetColumn = await this.prisma.column.findUnique({
      where: { id: dto.targetColumnId },
      select: { id: true, boardId: true, wipLimit: true },
    });
    if (!targetColumn) {
      throw new BadRequestException('Unknown targetColumnId');
    }

    if (targetColumn.boardId !== task.column.boardId) {
      throw new BadRequestException(
        'Cannot move a task to a column on a different board',
      );
    }

    // Count tasks already in the destination column. Used both for
    // the WIP-limit check and to clamp newOrder if the caller asked
    // for a position past the end of the column.
    const targetCount = await this.prisma.task.count({
      where: { columnId: dto.targetColumnId },
    });

    const movingWithinSameColumn = task.columnId === dto.targetColumnId;
    // When moving inside the same column, the count effectively
    // includes the moved task; clamping uses (count - 1) on the dest.
    const effectiveDestCount = movingWithinSameColumn
      ? targetCount - 1
      : targetCount;
    const clampedNewOrder = Math.min(dto.newOrder, effectiveDestCount);

    // WIP-limit check: only relevant when moving INTO a different
    // column. Same-column reorders never change the column's count.
    let wipWarning = false;
    if (!movingWithinSameColumn && targetColumn.wipLimit !== null) {
      if (targetCount + 1 > targetColumn.wipLimit) {
        wipWarning = true;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (movingWithinSameColumn) {
        // -------- Same-column reorder --------
        // Shift the slice between the old and the new position.
        if (clampedNewOrder === task.order) {
          // No-op move; just return the row.
          return tx.task.findUnique({
            where: { id: taskId },
            include: TASK_INCLUDE,
          });
        }
        if (clampedNewOrder < task.order) {
          // Moved up — increment everything in [newOrder, oldOrder)
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              order: { gte: clampedNewOrder, lt: task.order },
              id: { not: taskId },
            },
            data: { order: { increment: 1 } },
          });
        } else {
          // Moved down — decrement everything in (oldOrder, newOrder]
          await tx.task.updateMany({
            where: {
              columnId: task.columnId,
              order: { gt: task.order, lte: clampedNewOrder },
              id: { not: taskId },
            },
            data: { order: { decrement: 1 } },
          });
        }
        return tx.task.update({
          where: { id: taskId },
          data: { order: clampedNewOrder },
          include: TASK_INCLUDE,
        });
      }

      // -------- Cross-column move --------
      // 1. Close the gap in the source column.
      await tx.task.updateMany({
        where: {
          columnId: task.columnId,
          order: { gt: task.order },
        },
        data: { order: { decrement: 1 } },
      });

      // 2. Make room in the destination column.
      await tx.task.updateMany({
        where: {
          columnId: dto.targetColumnId,
          order: { gte: clampedNewOrder },
        },
        data: { order: { increment: 1 } },
      });

      // 3. Move the task.
      return tx.task.update({
        where: { id: taskId },
        data: {
          column: { connect: { id: dto.targetColumnId } },
          order: clampedNewOrder,
        },
        include: TASK_INCLUDE,
      });
    });

    if (!updated) throw new NotFoundException('Task not found after move');

    this.logger.log(
      `Moved task ${taskId}: ${task.columnId}@${task.order} → ${dto.targetColumnId}@${clampedNewOrder}`,
    );

    return {
      message: 'Task moved',
      task: this.toBoardTask(updated),
      wipWarning,
    };
  }

  // ===================================================================
  // Time entries
  // ===================================================================

  async addTimeEntry(
    taskId: string,
    dto: CreateTimeEntryDto,
  ): Promise<CreateTimeEntryResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, loggedHours: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.assertUserExists('userId', dto.userId);

    // Atomically: insert the time entry AND increment the task's
    // rolled-up loggedHours so dashboards don't have to sum the
    // child rows on every read.
    const [entry, updatedTask] = await this.prisma.$transaction([
      this.prisma.timeEntry.create({
        data: {
          taskId,
          userId: dto.userId,
          hours: dto.hours,
          date: new Date(dto.date),
          description: dto.description ?? null,
        },
      }),
      this.prisma.task.update({
        where: { id: taskId },
        data: { loggedHours: { increment: dto.hours } },
        select: { loggedHours: true },
      }),
    ]);

    return {
      message: 'Time entry recorded',
      timeEntry: this.toTimeEntry(entry),
      taskLoggedHours: Number(updatedTask.loggedHours),
    };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async resolveTargetColumn(
    projectId: string,
    explicitColumnId: string | undefined,
  ): Promise<string> {
    if (explicitColumnId) {
      const column = await this.prisma.column.findUnique({
        where: { id: explicitColumnId },
        select: {
          id: true,
          board: { select: { projectId: true } },
        },
      });
      if (!column) throw new BadRequestException('Unknown columnId');
      if (column.board.projectId !== projectId) {
        throw new BadRequestException(
          'columnId must belong to the given project',
        );
      }
      return column.id;
    }

    // No column specified — default to the first column of the
    // project's primary board.
    const firstColumn = await this.prisma.column.findFirst({
      where: { board: { projectId } },
      orderBy: [{ board: { createdAt: 'asc' } }, { order: 'asc' }],
      select: { id: true },
    });
    if (!firstColumn) {
      throw new BadRequestException(
        'Project has no board columns — create a board first',
      );
    }
    return firstColumn.id;
  }

  private async assertUserExists(field: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException(`Unknown ${field}: ${userId}`);
    }
  }

  // ---- Mappers ----

  private toDetail(task: TaskWithRelations): TaskDetail {
    return {
      ...this.toBoardTask(task),
      projectId: task.projectId,
      columnId: task.columnId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private toBoardTask(task: TaskWithRelations) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      order: task.order,
      assignee: task.assignee,
      reporter: task.reporter,
      estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : null,
      loggedHours: Number(task.loggedHours),
      dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
      labels: task.labels,
      parentId: task.parentId,
      sprintId: task.sprintId,
      subtaskCount: task._count.subtasks,
      timeEntryCount: task._count.timeEntries,
    };
  }

  private toTimeEntry(entry: {
    id: string;
    taskId: string;
    userId: string;
    hours: Prisma.Decimal;
    date: Date;
    description: string | null;
    createdAt: Date;
  }): TimeEntryDto {
    return {
      id: entry.id,
      taskId: entry.taskId,
      userId: entry.userId,
      hours: Number(entry.hours),
      date: entry.date.toISOString().slice(0, 10),
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
