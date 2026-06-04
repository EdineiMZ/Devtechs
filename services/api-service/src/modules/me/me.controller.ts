import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiKey } from '@szdevs/database';

import { CurrentApiKey } from '../../common/decorators/current-api-key.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('me')
@ApiBearerAuth('api-key')
@Controller('me')
@UseGuards(ApiKeyGuard)
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Get info about the current API key' })
  getMe(@CurrentApiKey() apiKey: ApiKey): object {
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      ipBinding: apiKey.ipBinding,
      boundIps: apiKey.boundIps,
      rateLimit: apiKey.rateLimit,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      totalRequests: apiKey.totalRequests,
      createdAt: apiKey.createdAt,
    };
  }
}
