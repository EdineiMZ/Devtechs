import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAdminGuard } from '../../common/guards/jwt-admin.guard';
import { AdminService } from './admin.service';
import {
  AuditLogQueryDto,
  CreateApiKeyDto,
  RevokeApiKeyDto,
  UpdateApiKeyDto,
} from './dto/admin.dto';

@ApiTags('admin-api-keys')
@ApiBearerAuth('jwt-admin')
@Controller('internal/api-keys')
@UseGuards(JwtAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all API keys' })
  listKeys(): Promise<unknown> {
    return this.adminService.listKeys();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an API key with last 50 audit events' })
  getKey(@Param('id') id: string): Promise<unknown> {
    return this.adminService.getKey(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Returns the full key string once — it is never stored and cannot be retrieved again.',
  })
  createKey(@Body() dto: CreateApiKeyDto): Promise<unknown> {
    return this.adminService.createKey(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update API key permissions, rate limits, or IP binding' })
  updateKey(@Param('id') id: string, @Body() dto: UpdateApiKeyDto): Promise<unknown> {
    return this.adminService.updateKey(id, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  revokeKey(@Param('id') id: string, @Body() dto: RevokeApiKeyDto): Promise<unknown> {
    return this.adminService.revokeKey(id, dto);
  }

  @Get(':id/audit-logs')
  @ApiOperation({ summary: 'Get paginated audit logs for an API key' })
  getAuditLogs(
    @Param('id') id: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<unknown> {
    return this.adminService.getAuditLogs(id, query);
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get usage metrics for an API key' })
  getMetrics(@Param('id') id: string): Promise<unknown> {
    return this.adminService.getMetrics(id);
  }
}
