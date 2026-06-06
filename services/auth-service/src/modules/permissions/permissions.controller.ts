import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RealIp } from '../../common/decorators/real-ip.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { GrantPermissionDto } from './dto/grant-permission.dto';
import type {
  GrantPermissionResponse,
  PermissionsByModuleResponse,
  RevokePermissionResponse,
} from './dto/permission-response.dto';
import { PermissionsService } from './permissions.service';

/**
 * Permission catalogue + direct user-permission grants.
 *
 * Stacked guards:
 *   1. `JwtAuthGuard` (global) — authenticates
 *   2. `PermissionGuard` — requires `dev:config:edit` (or the `admin`
 *      role, which bypasses all permission checks automatically).
 */
@Controller('permissions')
@UseGuards(PermissionGuard)
@RequirePermission('dev:config:edit')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(): Promise<PermissionsByModuleResponse> {
    return this.permissionsService.listGroupedByModule();
  }

  @Post('user/:userId')
  @HttpCode(HttpStatus.OK)
  grant(
    @Param('userId') userId: string,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() actor: CurrentUserPayload,
    @RealIp() ip: string,
  ): Promise<GrantPermissionResponse> {
    return this.permissionsService.grantToUser(
      userId,
      dto.permissionId,
      actor.id,
      ip,
    );
  }

  @Delete('user/:userId/:permissionId')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @RealIp() ip: string,
  ): Promise<RevokePermissionResponse> {
    return this.permissionsService.revokeFromUser(
      userId,
      permissionId,
      actor.id,
      ip,
    );
  }
}
