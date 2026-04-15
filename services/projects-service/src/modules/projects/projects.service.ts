import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@devtechs/database';

import { PrismaService } from '../../prisma/prisma.service';

import type { CreateProjectDto } from './dto/create-project.dto';
import type {
  ActiveSprintResponse,
  BoardColumnDto,
  BoardResponse,
  BoardTaskDto,
  BurndownDataPoint,
  PaginatedProjects,
  ProjectDetail,
  ProjectListItem,
} from './dto/project-response.dto';
import type { QueryProjectsDto } from './dto/query-projects.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

/**
 * Default columns created alongside every new project. Three is
 * the minimum useful Kanban setup; HR/PM teams reorder or rename
 * via task-list edits later.
 */
const DEFAULT_COLUMNS: ReadonlyArray<{ name: string; order: number }> = [
  { name: 'To Do', order: 0 },
  { name: 'In Progress', order: 1 },
  { name: 'Done', order: 2 },
];

const DEFAULT_BOARD_NAME = 'Main';

/**
 * Prisma include for the list endpoint — counts only, no nested rows.
 */
const PROJECT_LIST_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, email: true } },
  _count: { select: { members: true, tasks: true } },
} satisfies Prisma.ProjectInclude;

/**
 * Prisma include for the detail endpoint — adds the member roster.
 */
const PROJECT_DETAIL_INCLUDE = {
  ...PROJECT_LIST_INCLUDE,
  members: {
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.ProjectInclude;

type ProjectListRow = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_LIST_INCLUDE;
}>;
type ProjectDetailRow = Prisma.ProjectGetPayload<{
  include: typeof PROJECT_DETAIL_INCLUDE;
}>;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================
  // Project CRUD
  // ===================================================================

  async list(query: QueryProjectsDto): Promise<PaginatedProjects> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.ProjectWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.clientId) where.clientId = query.clientId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: PROJECT_LIST_INCLUDE,
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => this.toListItem(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async get(id: string): Promise<ProjectDetail> {
    const row = await this.prisma.project.findUnique({
      where: { id },
      include: PROJECT_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Project not found');
    return this.toDetail(row);
  }

  async create(dto: CreateProjectDto): Promise<ProjectDetail> {
    // Bootstrap a default Board + 3 default Columns alongside the
    // project so the kanban view is immediately usable. All four
    // writes happen inside one $transaction so a partial failure
    // never leaves a project without a board.
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    await this.assertUserExists('ownerId', dto.ownerId);
    if (dto.clientId) await this.assertUserExists('clientId', dto.clientId);

    const project = await this.prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description ?? null,
          status: dto.status ?? 'PLANNING',
          startDate,
          endDate,
          ownerId: dto.ownerId,
          clientId: dto.clientId ?? null,
          // The owner is automatically a member with the OWNER role.
          members: {
            create: { userId: dto.ownerId, role: 'OWNER' },
          },
        },
      });

      const board = await tx.board.create({
        data: { projectId: created.id, name: DEFAULT_BOARD_NAME },
      });

      await tx.column.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({
          boardId: board.id,
          name: c.name,
          order: c.order,
        })),
      });

      return created;
    });

    this.logger.log(
      `Created project ${project.id} (${project.name}) with default board + ${DEFAULT_COLUMNS.length} columns`,
    );
    return this.get(project.id);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectDetail> {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Project not found');

    if (dto.ownerId) await this.assertUserExists('ownerId', dto.ownerId);
    if (dto.clientId) await this.assertUserExists('clientId', dto.clientId);

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.ownerId !== undefined) {
      data.owner = { connect: { id: dto.ownerId } };
    }
    if (dto.clientId !== undefined) {
      data.client = dto.clientId
        ? { connect: { id: dto.clientId } }
        : { disconnect: true };
    }

    await this.prisma.project.update({ where: { id }, data });
    return this.get(id);
  }

  async remove(id: string): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new NotFoundException('Project not found');

    await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Deleted project ${id} (${existing.name})`);
    return { message: 'Project deleted', id };
  }

  // ===================================================================
  // Board — the hot path
  // ===================================================================

  /**
   * Returns the project's primary board with every column and every
   * task in one Prisma call. Prisma's join planner resolves this to
   * three batched SQL queries (board → columns → tasks), NEVER
   * N+1 per task. The `(columnId, order)` index on Task and the
   * `(boardId, order)` index on Column make both child fetches
   * index-only scans.
   *
   * If a project has multiple boards (rare today but allowed by the
   * schema), this returns the oldest one — the "default" board
   * created alongside the project.
   */
  async getBoard(projectId: string): Promise<BoardResponse> {
    const board = await this.prisma.board.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                assignee: { select: { id: true, name: true, email: true } },
                reporter: { select: { id: true, name: true, email: true } },
                _count: { select: { subtasks: true, timeEntries: true } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundException('No board found for this project');
    }

    const columns: BoardColumnDto[] = board.columns.map((col) => {
      const tasks = col.tasks.map((task) => this.toBoardTask(task));
      const overWipLimit =
        col.wipLimit !== null && col.tasks.length > col.wipLimit;
      return {
        id: col.id,
        name: col.name,
        order: col.order,
        wipLimit: col.wipLimit,
        taskCount: col.tasks.length,
        overWipLimit,
        tasks,
      };
    });

    return {
      board: {
        id: board.id,
        projectId: board.projectId,
        name: board.name,
      },
      columns,
    };
  }

  // ===================================================================
  // Active sprint + burndown
  // ===================================================================

  async getActiveSprint(projectId: string): Promise<ActiveSprintResponse> {
    // Hits the (projectId, status) composite index on Sprint.
    const sprint = await this.prisma.sprint.findFirst({
      where: { projectId, status: 'ACTIVE' },
      include: {
        tasks: {
          orderBy: [{ order: 'asc' }],
          include: {
            assignee: { select: { id: true, name: true, email: true } },
            reporter: { select: { id: true, name: true, email: true } },
            _count: { select: { subtasks: true, timeEntries: true } },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('No active sprint for this project');
    }

    // Total estimated hours for the sprint. Tasks without an
    // estimate contribute 0 — sprint planners are expected to
    // estimate before activating.
    const totalHours = sprint.tasks.reduce(
      (sum, task) => sum + (task.estimatedHours ? Number(task.estimatedHours) : 0),
      0,
    );

    // Per-day logged hours via TimeEntry rollup. The
    // `(taskId, date)` index makes this an index-only scan instead
    // of a heap walk.
    const taskIds = sprint.tasks.map((t) => t.id);
    const groupedTimeEntries =
      taskIds.length === 0
        ? []
        : await this.prisma.timeEntry.groupBy({
            by: ['date'],
            where: { taskId: { in: taskIds } },
            _sum: { hours: true },
          });

    const loggedByDate = new Map<string, number>();
    for (const row of groupedTimeEntries) {
      const dateKey = row.date.toISOString().slice(0, 10);
      const hours = row._sum.hours ? Number(row._sum.hours) : 0;
      loggedByDate.set(dateKey, hours);
    }

    const points = this.buildBurndown(
      sprint.startDate,
      sprint.endDate,
      totalHours,
      loggedByDate,
    );

    const loggedHours = points.reduce((sum, p) => sum + p.loggedOnDay, 0);

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate.toISOString().slice(0, 10),
        endDate: sprint.endDate.toISOString().slice(0, 10),
        status: sprint.status,
      },
      tasks: sprint.tasks.map((t) => this.toBoardTask(t)),
      burndown: {
        totalHours: round2(totalHours),
        loggedHours: round2(loggedHours),
        remainingHours: round2(Math.max(0, totalHours - loggedHours)),
        points,
      },
    };
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async assertUserExists(field: string, userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(`Unknown ${field}: ${userId}`);
    }
  }

  /**
   * Walks each day from sprintStart to sprintEnd inclusive, building
   * the burndown chart points. UTC arithmetic so a sprint that
   * crosses a DST boundary doesn't gain or lose a day.
   *
   *   - `ideal`    — straight line from totalHours → 0 over N days
   *   - `loggedOnDay`  — hours logged on that specific day
   *   - `remaining`    — totalHours minus cumulative logged so far
   */
  private buildBurndown(
    start: Date,
    end: Date,
    totalHours: number,
    loggedByDate: Map<string, number>,
  ): BurndownDataPoint[] {
    const points: BurndownDataPoint[] = [];

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
    if (endUtc < startUtc) return points;

    const totalDays =
      Math.floor((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
    const idealStep = totalDays > 1 ? totalHours / (totalDays - 1) : totalHours;

    let cumulativeLogged = 0;
    let dayIndex = 0;
    for (
      let cursor = startUtc;
      cursor <= endUtc;
      cursor += 24 * 60 * 60 * 1000, dayIndex++
    ) {
      const dateKey = new Date(cursor).toISOString().slice(0, 10);
      const loggedOnDay = loggedByDate.get(dateKey) ?? 0;
      cumulativeLogged += loggedOnDay;
      const ideal = Math.max(0, totalHours - idealStep * dayIndex);
      const remaining = Math.max(0, totalHours - cumulativeLogged);
      points.push({
        date: dateKey,
        remaining: round2(remaining),
        ideal: round2(ideal),
        loggedOnDay: round2(loggedOnDay),
      });
    }
    return points;
  }

  private toListItem(row: ProjectListRow): ProjectListItem {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
      owner: { id: row.owner.id, name: row.owner.name, email: row.owner.email },
      client: row.client
        ? { id: row.client.id, name: row.client.name, email: row.client.email }
        : null,
      memberCount: row._count.members,
      taskCount: row._count.tasks,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: ProjectDetailRow): ProjectDetail {
    const base = this.toListItem(row);
    return {
      ...base,
      members: row.members.map((m) => ({
        user: { id: m.user.id, name: m.user.name, email: m.user.email },
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  private toBoardTask(task: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    priority: string;
    status: string;
    order: number;
    assignee: { id: string; name: string; email: string } | null;
    reporter: { id: string; name: string; email: string };
    estimatedHours: Prisma.Decimal | null;
    loggedHours: Prisma.Decimal;
    dueDate: Date | null;
    labels: string[];
    parentId: string | null;
    sprintId: string | null;
    _count: { subtasks: number; timeEntries: number };
  }): BoardTaskDto {
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
}

/** Round to 2 decimal places, returning a number. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
