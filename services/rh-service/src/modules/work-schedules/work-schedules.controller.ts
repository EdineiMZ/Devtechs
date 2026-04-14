import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import type {
  WorkScheduleHistoryResponse,
  WorkScheduleItem,
} from './dto/work-schedule-response.dto';
import { WorkSchedulesService } from './work-schedules.service';

/**
 * Work schedule history endpoints.
 *
 * Defining a new schedule requires `rh:employees:edit` (same
 * permission HR uses to manage the rest of an employee's record).
 * Reading history requires `rh:employees:view`, which the spec
 * doesn't state explicitly but matches every other read path in
 * rh-service.
 *
 * Route prefix uses a dash (`work-schedule`) because the spec cited
 * `/work-schedule/:employeeId` literally — we keep the URL shape
 * faithful to the spec even though the controller class uses the
 * plural `WorkSchedules` internally.
 */
@Controller('work-schedule')
@UseGuards(PermissionGuard)
export class WorkSchedulesController {
  constructor(private readonly workSchedulesService: WorkSchedulesService) {}

  // -----------------------------------------------------------------
  // POST /work-schedule/:employeeId — define a new schedule
  // -----------------------------------------------------------------
  @Post(':employeeId')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('rh:employees:edit')
  create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateWorkScheduleDto,
  ): Promise<WorkScheduleItem> {
    return this.workSchedulesService.create(employeeId, dto);
  }

  // -----------------------------------------------------------------
  // GET /work-schedule/:employeeId — full history, newest first
  // -----------------------------------------------------------------
  @Get(':employeeId')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  list(
    @Param('employeeId') employeeId: string,
  ): Promise<WorkScheduleHistoryResponse> {
    return this.workSchedulesService.list(employeeId);
  }
}
