import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { AgrivorAdminService, KeyStatus } from './agrivor-admin.service';

class IssueKeyBodyDto {
  customerId!: string;
  modules!: string[];
  expiresInDays!: number;
}

class RenewKeyBodyDto {
  expiresInDays!: number;
}

@ApiTags('admin-agrivor')
@Controller('admin/agrivor')
@UseGuards(PermissionGuard)
@RequirePermission('licenses:admin:agrivor')
export class AgrivorAdminController {
  constructor(private readonly agrivorAdmin: AgrivorAdminService) {}

  @Get('keys')
  @ApiOperation({ summary: 'List all AGRIVOR activation keys with optional status filter' })
  listKeys(@Query('status') status?: string) {
    const validStatuses: KeyStatus[] = ['ACTIVE', 'EXPIRED', 'REVOKED'];
    const normalized = status?.toUpperCase() as KeyStatus | undefined;
    return this.agrivorAdmin.listKeys(
      normalized && validStatuses.includes(normalized) ? normalized : undefined,
    );
  }

  @Post('keys/issue')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Issue a new AGRIVOR activation key' })
  issueKey(@Body() body: IssueKeyBodyDto) {
    return this.agrivorAdmin.issueKey({
      customerId: body.customerId,
      modules: body.modules,
      expiresInDays: body.expiresInDays,
    });
  }

  @Delete('keys/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an AGRIVOR activation key by internal ID' })
  async revokeKey(@Param('id') id: string) {
    await this.agrivorAdmin.revokeKey(id);
    return { ok: true };
  }

  @Post('keys/:id/renew')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Renew an AGRIVOR key — re-issues JWT keeping same customerId and modules' })
  renewKey(@Param('id') id: string, @Body() body: RenewKeyBodyDto) {
    return this.agrivorAdmin.renewKey(id, body.expiresInDays);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List AGRIVOR payment history from processed webhooks' })
  listPayments(@Query('customerId') customerId?: string) {
    return this.agrivorAdmin.listPayments(customerId);
  }

  @Get('telemetry')
  @ApiOperation({ summary: 'Get telemetry snapshot for all AGRIVOR keys' })
  getTelemetry() {
    return this.agrivorAdmin.getTelemetry();
  }
}
