import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiKey } from '@szdevs/database';
import type { Request } from 'express';

import { RequireApiPermission } from '../../common/decorators/require-api-permission.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireApiPermissionGuard } from '../../common/guards/require-api-permission.guard';
import { TicketsService } from './tickets.service';

type ApiRequest = Request & { apiKey: ApiKey };

@ApiTags('tickets')
@ApiBearerAuth('api-key')
@Controller('tickets')
@UseGuards(ApiKeyGuard, RequireApiPermissionGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequireApiPermission('tickets:read')
  @ApiOperation({ summary: 'List tickets' })
  listTickets(@Req() req: ApiRequest): Promise<unknown> {
    return this.tickets.proxy(req, '/tickets', 'GET');
  }

  @Get(':id')
  @RequireApiPermission('tickets:read')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  getTicket(@Req() req: ApiRequest, @Param('id') id: string): Promise<unknown> {
    return this.tickets.proxy(req, `/tickets/${id}`, 'GET');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireApiPermission('tickets:write')
  @ApiOperation({ summary: 'Create a ticket' })
  createTicket(@Req() req: ApiRequest, @Body() body: unknown): Promise<unknown> {
    return this.tickets.proxy(req, '/tickets', 'POST', body);
  }

  @Post(':id/reply')
  @HttpCode(HttpStatus.CREATED)
  @RequireApiPermission('tickets:write')
  @ApiOperation({ summary: 'Reply to a ticket' })
  replyTicket(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.tickets.proxy(req, `/tickets/${id}/messages`, 'POST', body);
  }

  @Patch(':id/status')
  @RequireApiPermission('tickets:status')
  @ApiOperation({ summary: 'Update ticket status' })
  updateStatus(
    @Req() req: ApiRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.tickets.proxy(req, `/tickets/${id}/status`, 'PATCH', body);
  }
}
