import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import {
  AssignTicketDto,
  CreateMessageDto,
  CreateTicketDto,
  QueryTicketsDto,
  RateTicketDto,
  UpdateStatusDto,
} from './dto/ticket.dto';
import { TicketsService } from './tickets.service';

/**
 * Ticket REST endpoints. Permissions per spec:
 *
 *   - GET /tickets, GET /tickets/:id  → support:tickets:view
 *   - POST /tickets                    → any authenticated user
 *   - PUT /tickets/:id/assign          → support:tickets:close
 *   - PUT /tickets/:id/status          → support:tickets:close
 *   - POST /tickets/:id/messages       → any authenticated user
 *   - PUT /tickets/:id/close           → support:tickets:close
 *   - POST /tickets/:id/rating         → any authenticated user
 *   - GET /tickets/sla-breach          → support:sla:manage
 */
@Controller('tickets')
@UseGuards(PermissionGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  // -------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:view')
  list(
    @Query() query: QueryTicketsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.list(query, user.id);
  }

  @Get('sla-breach')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:sla:manage')
  slaBreach(): Promise<unknown[]> {
    return this.tickets.listSlaBreach();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:view')
  get(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.get(id, user.id);
  }

  // -------------------------------------------------------------------
  // Writes — any authenticated user
  // -------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.create(dto, user.id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.addMessage(id, dto, user.id);
  }

  @Post(':id/rating')
  @HttpCode(HttpStatus.OK)
  rate(
    @Param('id') id: string,
    @Body() dto: RateTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.rate(id, dto, user.id);
  }

  // -------------------------------------------------------------------
  // Writes — support staff
  // -------------------------------------------------------------------

  @Put(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.assign(id, dto, user.id);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.updateStatus(id, dto, user.id);
  }

  @Put(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('support:tickets:close')
  close(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.tickets.close(id, user.id);
  }
}
