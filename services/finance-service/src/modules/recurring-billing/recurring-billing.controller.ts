import {
  Body,
  Controller,
  Delete,
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

import { BillingProductsService } from './billing-products.service';
import { RecurringSubscriptionsService } from './recurring-subscriptions.service';
import { CreateBillingProductDto, UpdateBillingProductDto } from './dto/billing-product.dto';
import {
  CancelRecurringSubscriptionDto,
  CreateRecurringSubscriptionDto,
  UpdateRecurringSubscriptionDto,
} from './dto/recurring-subscription.dto';

@Controller('recurring-billing')
@UseGuards(PermissionGuard)
export class RecurringBillingController {
  constructor(
    private readonly products: BillingProductsService,
    private readonly subscriptions: RecurringSubscriptionsService,
  ) {}

  // ────────────────────────────── Products ──────────────────────────────

  @Get('products')
  @RequirePermission('finance:reports:view')
  listProducts(@Query('active') active?: string): Promise<unknown[]> {
    return this.products.list(active === 'true');
  }

  @Get('products/:id')
  @RequirePermission('finance:reports:view')
  getProduct(@Param('id') id: string): Promise<unknown> {
    return this.products.get(id);
  }

  @Post('products')
  @RequirePermission('finance:invoices:issue')
  @HttpCode(HttpStatus.CREATED)
  createProduct(@Body() dto: CreateBillingProductDto): Promise<unknown> {
    return this.products.create(dto);
  }

  @Put('products/:id')
  @RequirePermission('finance:invoices:issue')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateBillingProductDto,
  ): Promise<unknown> {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  @RequirePermission('finance:invoices:issue')
  @HttpCode(HttpStatus.OK)
  deactivateProduct(@Param('id') id: string): Promise<{ message: string; id: string }> {
    return this.products.deactivate(id);
  }

  // ─────────────────────────── Subscriptions ────────────────────────────

  @Get('subscriptions')
  @RequirePermission('finance:reports:view')
  listSubscriptions(
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ): Promise<unknown[]> {
    return this.subscriptions.list({ clientId, status });
  }

  @Get('subscriptions/:id')
  @RequirePermission('finance:reports:view')
  getSubscription(@Param('id') id: string): Promise<unknown> {
    return this.subscriptions.get(id);
  }

  @Post('subscriptions')
  @RequirePermission('finance:invoices:issue')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(
    @Body() dto: CreateRecurringSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.subscriptions.create(dto, user.id);
  }

  @Put('subscriptions/:id')
  @RequirePermission('finance:invoices:issue')
  updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringSubscriptionDto,
  ): Promise<unknown> {
    return this.subscriptions.update(id, dto);
  }

  @Post('subscriptions/:id/cancel')
  @RequirePermission('finance:invoices:issue')
  @HttpCode(HttpStatus.OK)
  cancelSubscription(
    @Param('id') id: string,
    @Body() dto: CancelRecurringSubscriptionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.subscriptions.cancel(id, dto, user.id);
  }

  /** Manual trigger for the billing cycle (staff only, for testing/recovery). */
  @Post('billing-cycle/run')
  @RequirePermission('finance:invoices:issue')
  @HttpCode(HttpStatus.OK)
  runBillingCycle(): Promise<{ generated: number; errors: number }> {
    return this.subscriptions.runBillingCycle();
  }
}
