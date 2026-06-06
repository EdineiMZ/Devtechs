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

  /** Runs daily at 07:00 to remind clients whose billing date is 3 days away. */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handlePaymentDueReminders(): Promise<void> {
    this.logger.log('Checking for upcoming billing reminders...');
    try {
      const result = await this.service.sendPaymentDueReminders();
      this.logger.log(`Payment due reminders: ${result.sent} sent`);
    } catch (err) {
      this.logger.error(`Payment due reminders failed: ${String(err)}`);
    }
  }
}
