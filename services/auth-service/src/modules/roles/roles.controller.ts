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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

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
@ApiTags('roles')
@ApiBearerAuth('bearer')
@Controller('roles')
@UseGuards(PermissionGuard)
@RequirePermission('dev:config:edit')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new role with attached permissions',
    description:
      'Atomically creates a role and links the listed permissions to it. ' +
      'The actor must hold `dev:config:edit` (admins bypass). Audit log ' +
      'records action `ROLE_CREATED` with the role + permission IDs.',
  })
  @ApiBody({
    type: CreateRoleDto,
    examples: {
      supportAgent: {
        summary: 'Create the support-agent role',
        value: {
          name: 'support-agent',
          description: 'Atende chamados de suporte e gerencia base de conhecimento.',
          requireEmailVerified: true,
          require2FA: false,
          permissionIds: [
            'cln9p1ab0001qe7zabc12345',
            'cln9p1ab0002qe7zabc67890',
            'cln9p1ab0003qe7zabcKB001',
          ],
        },
      },
      readOnlyAuditor: {
        summary: 'Read-only auditor (no permissions yet)',
        value: {
          name: 'auditor',
          description: 'Leitura de logs e relatórios.',
          requireEmailVerified: true,
          require2FA: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Role created, permissions attached.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'cln9px8s90001qe7zsupportid' },
        name: { type: 'string', example: 'support-agent' },
        description: {
          type: 'string',
          nullable: true,
          example: 'Atende chamados de suporte e gerencia base de conhecimento.',
        },
        isSystem: { type: 'boolean', example: false },
        requireEmailVerified: { type: 'boolean', example: true },
        require2FA: { type: 'boolean', example: false },
        createdAt: { type: 'string', format: 'date-time' },
        permissions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string', example: 'support:tickets:close' },
              name: { type: 'string' },
              module: { type: 'string', example: 'SUPORTE' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed (bad name pattern, unknown permissionIds).' })
  @ApiResponse({ status: 401, description: 'No bearer token.' })
  @ApiResponse({ status: 403, description: 'Caller lacks `dev:config:edit`.' })
  @ApiResponse({ status: 409, description: 'A role with this name already exists.' })
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
