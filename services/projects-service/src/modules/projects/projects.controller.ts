import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateProjectDto } from './dto/create-project.dto';
import type {
  ActiveSprintResponse,
  BoardResponse,
  PaginatedProjects,
  ProjectDetail,
} from './dto/project-response.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

/**
 * Project CRUD + read endpoints for the kanban board and active sprint.
 *
 * Permissions per spec:
 *   - GET (list + detail) → projects:reports:view
 *   - POST → projects:create
 *   - PUT  → projects:create  (no separate update perm in the seed)
 *   - DELETE → projects:delete
 *   - GET /:id/board → projects:reports:view
 *   - GET /:id/sprint/active → projects:reports:view
 */
@Controller('projects')
@UseGuards(PermissionGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // -----------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  list(@Query() query: QueryProjectsDto): Promise<PaginatedProjects> {
    return this.projectsService.list(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  get(@Param('id') id: string): Promise<ProjectDetail> {
    return this.projectsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:create')
  create(@Body() dto: CreateProjectDto): Promise<ProjectDetail> {
    return this.projectsService.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDetail> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:delete')
  remove(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.projectsService.remove(id);
  }

  // -----------------------------------------------------------------
  // Board + sprint reads
  // -----------------------------------------------------------------

  /**
   * GET /projects/:id/board
   *
   * Returns the project's primary kanban board with all columns and
   * tasks in one optimized Prisma call (see ProjectsService.getBoard
   * for the join planner's index path).
   */
  @Get(':id/board')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  getBoard(@Param('id') projectId: string): Promise<BoardResponse> {
    return this.projectsService.getBoard(projectId);
  }

  /**
   * GET /projects/:id/sprint/active
   *
   * Returns the currently ACTIVE sprint for the project, with its
   * task list and a burndown payload suitable for chart rendering.
   */
  @Get(':id/sprint/active')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  getActiveSprint(
    @Param('id') projectId: string,
  ): Promise<ActiveSprintResponse> {
    return this.projectsService.getActiveSprint(projectId);
  }
}
