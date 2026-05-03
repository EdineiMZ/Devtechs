import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PermissionResolverService } from '../../common/permissions/permission-resolver.service';

import { CreateProjectDto } from './dto/create-project.dto';
import type {
  ActiveSprintResponse,
  BoardResponse,
  MilestoneDto,
  PaginatedProjects,
  ProjectDetail,
} from './dto/project-response.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

class CreateMilestoneDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  completedAt?: string | null;
}

const STAFF_PERMISSION = 'projects:reports:view';

const MEMBER_ROLES = [
  'OWNER',
  'MANAGER',
  'DEVELOPER',
  'DESIGNER',
  'QA_ENGINEER',
  'SECURITY_ENGINEER',
  'DEVOPS',
  'VIEWER',
] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

class AddMemberDto {
  @IsString()
  userId!: string;

  @IsEnum(MEMBER_ROLES)
  role!: MemberRole;
}

class UpdateMemberDto {
  @IsEnum(MEMBER_ROLES)
  role!: MemberRole;
}

/**
 * Project CRUD + read endpoints for the kanban board, active sprint, and milestones.
 */
@Controller('projects')
@UseGuards(PermissionGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly resolver: PermissionResolverService,
  ) {}

  // -----------------------------------------------------------------
  // CRUD
  // -----------------------------------------------------------------

  /** Staff see all projects; clients are scoped to their own (clientId forced). */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: QueryProjectsDto,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<PaginatedProjects> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    if (!perms.has(STAFF_PERMISSION)) {
      return this.projectsService.list({ ...query, clientId: user.id });
    }
    return this.projectsService.list(query);
  }

  /** Staff see any project; clients only see their own. */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async get(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ProjectDetail> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    if (!perms.has(STAFF_PERMISSION)) {
      return this.projectsService.getForClient(id, user.id);
    }
    return this.projectsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:create')
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ProjectDetail> {
    return this.projectsService.create(dto, user?.id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<ProjectDetail> {
    return this.projectsService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:delete')
  remove(
    @Param('id') id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<{ message: string; id: string }> {
    return this.projectsService.remove(id, user?.id);
  }

  // -----------------------------------------------------------------
  // Board + sprint reads
  // -----------------------------------------------------------------

  @Get(':id/board')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  getBoard(@Param('id') projectId: string): Promise<BoardResponse> {
    return this.projectsService.getBoard(projectId);
  }

  @Get(':id/sprint/active')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:reports:view')
  getActiveSprint(
    @Param('id') projectId: string,
  ): Promise<ActiveSprintResponse> {
    return this.projectsService.getActiveSprint(projectId);
  }

  // -----------------------------------------------------------------
  // Members — add / update role / remove
  // -----------------------------------------------------------------

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:create')
  addMember(
    @Param('id') projectId: string,
    @Body() dto: AddMemberDto,
  ): Promise<unknown> {
    return this.projectsService.addMember(projectId, dto.userId, dto.role);
  }

  @Put(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  updateMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<unknown> {
    return this.projectsService.updateMember(projectId, userId, dto.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  removeMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
  ): Promise<{ message: string }> {
    return this.projectsService.removeMember(projectId, userId);
  }

  // -----------------------------------------------------------------
  // Milestones — progress tracking visible to clients
  // -----------------------------------------------------------------

  /** Staff and the project's own client can list milestones. */
  @Get(':id/milestones')
  @HttpCode(HttpStatus.OK)
  async listMilestones(
    @Param('id') projectId: string,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<MilestoneDto[]> {
    if (!user) throw new ForbiddenException('Authentication required');
    const perms = await this.resolver.getPermissions(user.id);
    if (!perms.has(STAFF_PERMISSION)) {
      // Verify the project belongs to this client
      await this.projectsService.getForClient(projectId, user.id);
    }
    return this.projectsService.listMilestones(projectId);
  }

  @Post(':id/milestones')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:create')
  createMilestone(
    @Param('id') projectId: string,
    @Body() dto: CreateMilestoneDto,
  ): Promise<MilestoneDto> {
    return this.projectsService.createMilestone(projectId, dto);
  }

  @Put(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  updateMilestone(
    @Param('id') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ): Promise<MilestoneDto> {
    return this.projectsService.updateMilestone(projectId, milestoneId, dto);
  }

  @Delete(':id/milestones/:milestoneId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:create')
  deleteMilestone(
    @Param('id') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ): Promise<{ message: string }> {
    return this.projectsService.deleteMilestone(projectId, milestoneId);
  }

  // Client-accessible endpoint: only returns progress + milestones
  @Get(':id/progress')
  @HttpCode(HttpStatus.OK)
  getProgress(
    @Param('id') projectId: string,
  ): Promise<{ progressPercent: number; milestones: MilestoneDto[] }> {
    return this.projectsService.getProgress(projectId);
  }
}
