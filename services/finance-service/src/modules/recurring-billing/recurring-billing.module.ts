import { Module } from '@nestjs/common';

import { AuthClientModule } from '../../auth-client/auth-client.module';
import { PermissionResolverModule } from '../../common/permissions/permission-resolver.module';
import { RedisModule } from '../../redis/redis.module';

import { BillingProductsService } from './billing-products.service';
import { RecurringBillingController } from './recurring-billing.controller';
import { RecurringBillingScheduler } from './recurring-billing.scheduler';
import { RecurringSubscriptionsService } from './recurring-subscriptions.service';

@Module({
  imports: [RedisModule, AuthClientModule, PermissionResolverModule],
  controllers: [RecurringBillingController],
  providers: [BillingProductsService, RecurringSubscriptionsService, RecurringBillingScheduler],
  exports: [RecurringSubscriptionsService],
})
export class RecurringBillingModule {}
