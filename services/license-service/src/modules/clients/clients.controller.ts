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

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { BindClientDto } from './dto/bind-client.dto';
import { ClientsService } from './clients.service';

@Controller('clients')
@UseGuards(PermissionGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post(':clientId/bind')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('licenses:clients:bind')
  bind(
    @Param('clientId') clientId: string,
    @Body() dto: BindClientDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.clients.bind(clientId, dto, user.id);
  }

  @Get(':clientId/tokens')
  @RequirePermission('licenses:audit:view')
  listTokens(@Param('clientId') clientId: string): Promise<unknown[]> {
    return this.clients.listTokens(clientId);
  }
}
