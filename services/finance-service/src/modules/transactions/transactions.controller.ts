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

import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  CashflowQueryDto,
  QueryTransactionsDto,
  SummaryQueryDto,
} from './dto/query-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

/**
 * Permissions per spec:
 *   - GET  /transactions        → finance:reports:view
 *   - POST /transactions        → finance:accounts:edit
 *   - PUT  /transactions/:id    → finance:accounts:edit
 *   - PUT  /transactions/:id/pay → finance:accounts:edit
 *   - GET  /transactions/summary → finance:reports:view
 *   - GET  /transactions/cashflow → finance:reports:view
 */
@Controller('transactions')
@UseGuards(PermissionGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:reports:view')
  list(@Query() query: QueryTransactionsDto): Promise<unknown> {
    return this.transactions.list(query);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:reports:view')
  summary(@Query() query: SummaryQueryDto): Promise<unknown> {
    return this.transactions.summary(query);
  }

  @Get('cashflow')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:reports:view')
  cashflow(@Query() query: CashflowQueryDto): Promise<unknown> {
    return this.transactions.cashflow(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('finance:accounts:edit')
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.transactions.create(dto, user.id);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:accounts:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.transactions.update(id, dto, user.id);
  }

  @Put(':id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('finance:accounts:edit')
  markPaid(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.transactions.markPaid(id, user.id);
  }
}
