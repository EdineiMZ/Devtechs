import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import { DeploymentsService } from './deployments.service';

@Controller('deployments')
@UseGuards(PermissionGuard)
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:pipelines:view')
  list(): Promise<unknown[]> {
    return this.deployments.list();
  }

  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('devops:rollback:execute')
  rollback(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.deployments.rollback(id, user.id);
  }
}
