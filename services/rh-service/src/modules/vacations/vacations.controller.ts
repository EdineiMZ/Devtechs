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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { CreateVacationDto } from './dto/create-vacation.dto';
import { QueryVacationsDto } from './dto/query-vacations.dto';
import { RejectVacationDto } from './dto/reject-vacation.dto';
import type {
  PaginatedVacations,
  VacationActionResponse,
  VacationItem,
} from './dto/vacation-response.dto';
import { VacationsService } from './vacations.service';

/**
 * Vacation requests + absence approvals.
 *
 * Guard stack at the controller level: `PermissionGuard` runs
 * per-method after the global `JwtAuthGuard`. Each method declares
 * the permission(s) it needs via `@RequirePermission`.
 *
 * Permissions used:
 *   - `rh:employees:view` — read access (GET list, GET detail, POST
 *     create, DELETE cancel). POST is gated by this permission but
 *     the service additionally verifies ownership of the employee
 *     record unless the user also holds `rh:vacations:approve`.
 *   - `rh:vacations:approve` — approve / reject decisions.
 */
@Controller('vacations')
@UseGuards(PermissionGuard)
export class VacationsController {
  constructor(private readonly vacationsService: VacationsService) {}

  // -----------------------------------------------------------------
  // GET /vacations — list with filters + pagination
  // -----------------------------------------------------------------
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  list(@Query() query: QueryVacationsDto): Promise<PaginatedVacations> {
    return this.vacationsService.list(query);
  }

  // -----------------------------------------------------------------
  // GET /vacations/:id — detail
  // -----------------------------------------------------------------
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  get(@Param('id') id: string): Promise<VacationItem> {
    return this.vacationsService.get(id);
  }

  // -----------------------------------------------------------------
  // POST /vacations — submit a new request
  //
  // Self-service by default. The service rejects attempts to create
  // on behalf of another employee unless the caller also holds
  // `rh:vacations:approve`.
  // -----------------------------------------------------------------
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('rh:employees:view')
  create(
    @Body() dto: CreateVacationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<VacationItem> {
    return this.vacationsService.create(dto, user.id);
  }

  // -----------------------------------------------------------------
  // PUT /vacations/:id/approve
  // -----------------------------------------------------------------
  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:vacations:approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<VacationActionResponse> {
    return this.vacationsService.approve(id, user.id);
  }

  // -----------------------------------------------------------------
  // PUT /vacations/:id/reject
  // -----------------------------------------------------------------
  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:vacations:approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectVacationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<VacationActionResponse> {
    return this.vacationsService.reject(id, dto, user.id);
  }

  // -----------------------------------------------------------------
  // DELETE /vacations/:id — cancel
  //
  // Service-side rule: only while PENDING, and either by the employee
  // whose userId matches `request.user.id` or by a user holding
  // `rh:vacations:approve`.
  // -----------------------------------------------------------------
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('rh:employees:view')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<VacationActionResponse> {
    return this.vacationsService.cancel(id, user.id);
  }
}
