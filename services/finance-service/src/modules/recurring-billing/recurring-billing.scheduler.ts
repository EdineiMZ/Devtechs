import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RecurringSubscriptionsService } from './recurring-subscriptions.service';

@Injectable()
export class RecurringBillingScheduler {
  private readonly logger = new Logger(RecurringBillingScheduler.name);

  constructor(private readonly service: RecurringSubscriptionsService) {}

  /** Runs daily at 06:00 to generate invoices for due subscriptions. */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleBillingCycle(): Promise<void> {
    this.logger.log('Starting recurring billing cycle...');
    try {
      const result = await this.service.runBillingCycle();
      this.logger.log(
        `Recurring billing cycle done: ${result.generated} invoices, ${result.errors} errors`,
      );
    } catch (err) {
      this.logger.error(`Recurring billing cycle failed: ${String(err)}`);
    }
  }
}
