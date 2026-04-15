import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import type {
  CreateTimeEntryResponse,
  MoveTaskResponse,
  TaskDetail,
} from './dto/task-response.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

/**
 * Task CRUD + drag-and-drop + time tracking.
 *
 * Permissions:
 *   - POST /tasks           → projects:tasks:assign
 *   - PUT /tasks/:id        → projects:tasks:assign
 *   - PUT /tasks/:id/column → projects:tasks:assign
 *   - POST /tasks/:id/time-entries → projects:tasks:assign
 *
 * Per-project membership checks are not enforced today — anyone
 * with the global permission can act on any project. A future turn
 * should add a runtime ProjectMember lookup so a developer can
 * only modify tasks in their own projects.
 */
@Controller('tasks')
@UseGuards(PermissionGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:tasks:assign')
  create(@Body() dto: CreateTaskDto): Promise<TaskDetail> {
    return this.tasksService.create(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:tasks:assign')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDetail> {
    return this.tasksService.update(id, dto);
  }

  /**
   * PUT /tasks/:id/column — drag-and-drop endpoint.
   *
   * Body: { targetColumnId, newOrder }
   *
   * Renumbers BOTH the source and destination columns inside one
   * $transaction so concurrent drags don't corrupt the order
   * sequence. WIP-limit warnings are returned as a non-blocking
   * `wipWarning: true` flag — the move still succeeds so the UI
   * can prompt the user before sending a corrective move.
   */
  @Put(':id/column')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('projects:tasks:assign')
  moveColumn(
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ): Promise<MoveTaskResponse> {
    return this.tasksService.moveToColumn(id, dto);
  }

  @Post(':id/time-entries')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('projects:tasks:assign')
  addTimeEntry(
    @Param('id') taskId: string,
    @Body() dto: CreateTimeEntryDto,
  ): Promise<CreateTimeEntryResponse> {
    return this.tasksService.addTimeEntry(taskId, dto);
  }
}
