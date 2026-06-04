import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiKey } from '@szdevs/database';
import type { Request } from 'express';

import { RequireApiPermission } from '../../common/decorators/require-api-permission.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { ProjectsService } from './projects.service';

type ApiRequest = Request & { apiKey: ApiKey };

@ApiTags('projects')
@ApiBearerAuth('api-key')
@Controller('projects')
@UseGuards(ApiKeyGuard, RequireApiPermissionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequireApiPermission('projects:read')
  @ApiOperation({ summary: 'List projects' })
  listProjects(@Req() req: ApiRequest): Promise<unknown> {
    return this.projects.proxy(req, '/projects', 'GET');
  }

  @Get(':id')
  @RequireApiPermission('projects:read')
  @ApiOperation({ summary: 'Get a project by ID' })
  getProject(@Req() req: ApiRequest, @Param('id') id: string): Promise<unknown> {
    return this.projects.proxy(req, `/projects/${id}`, 'GET');
  }

  @Post(':id/tasks')
  @HttpCode(HttpStatus.CREATED)
  @RequireApiPermission('projects:write')
  @ApiOperation({ summary: 'Create a task in a project' })
  createTask(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.projects.proxy(req, `/projects/${id}/tasks`, 'POST', body);
  }

  @Patch(':id/tasks/:taskId')
  @RequireApiPermission('projects:write')
  @ApiOperation({ summary: 'Update a task' })
  updateTask(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.projects.proxy(req, `/projects/${id}/tasks/${taskId}`, 'PATCH', body);
  }
}
