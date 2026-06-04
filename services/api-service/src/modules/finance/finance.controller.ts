import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiKey } from '@szdevs/database';
import type { Request } from 'express';

import { RequireApiPermission } from '../../common/decorators/require-api-permission.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { FinanceService } from './finance.service';

type ApiRequest = Request & { apiKey: ApiKey };

@ApiTags('finance')
@ApiBearerAuth('api-key')
@Controller()
@UseGuards(ApiKeyGuard, RequireApiPermissionGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('invoices')
  @RequireApiPermission('finance:read')
  @ApiOperation({ summary: 'List invoices' })
  listInvoices(@Req() req: ApiRequest): Promise<unknown> {
    return this.finance.proxy(req, '/invoices', 'GET');
  }

  @Get('subscriptions')
  @RequireApiPermission('finance:read')
  @ApiOperation({ summary: 'List subscriptions' })
  listSubscriptions(@Req() req: ApiRequest): Promise<unknown> {
    return this.finance.proxy(req, '/subscriptions', 'GET');
  }
}
