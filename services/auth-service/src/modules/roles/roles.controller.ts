import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
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

import { CreateRoleDto } from './dto/create-role.dto';
import { QueryRolesDto } from './dto/query-roles.dto';
import type {
  AssignRoleResponse,
  RoleResponse,
  UnassignRoleResponse,
} from './dto/role-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

/**
 * Role administration endpoints. Every route requires the authenticated
 * user to hold the `dev:config:edit` permission — with the conventional
 * `admin` role bypass handled by `PermissionGuard`. Both guards are
 * stacked here so that an admin can manage roles without being granted
 * the dev permission explicitly.
 *
 * Guard order (outer → inner):
 *   1. `JwtAuthGuard` (global) — authenticates
 *   2. `PermissionGuard` — checks metadata from `@RequirePermission()`;
 *      bypassed when `user.roles` contains `admin`.
 */
@Controller('roles')
@UseGuards(PermissionGuard)
@RequirePermission('dev:config:edit')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<RoleResponse> {
    return this.rolesService.create(dto, actor.id, ip);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: QueryRolesDto): Promise<RoleResponse[]> {
    return this.rolesService.list(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  get(@Param('id') id: string): Promise<RoleResponse> {
    return this.rolesService.get(id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<RoleResponse> {
    return this.rolesService.update(id, dto, actor.id, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<void> {
    await this.rolesService.remove(id, actor.id, ip);
  }

  // -------------------------------------------------------------------
  // User <-> Role assignments
  // -------------------------------------------------------------------

  @Post(':id/assign/:userId')
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<AssignRoleResponse> {
    return this.rolesService.assignToUser(roleId, userId, actor.id, ip);
  }

  @Delete(':id/unassign/:userId')
  @HttpCode(HttpStatus.OK)
  unassign(
    @Param('id') roleId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Ip() ip: string,
  ): Promise<UnassignRoleResponse> {
    return this.rolesService.unassignFromUser(roleId, userId, actor.id, ip);
  }
}
