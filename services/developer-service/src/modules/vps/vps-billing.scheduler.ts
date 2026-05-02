import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { VpsBillingService } from './vps-billing.service';

@Injectable()
export class VpsBillingScheduler {
  private readonly logger = new Logger(VpsBillingScheduler.name);

  constructor(private readonly billing: VpsBillingService) {}

  /** Generate monthly invoices at 01:00 every day. */
  @Cron('0 1 * * *')
  async handleBillingCycle(): Promise<void> {
    this.logger.log('Starting VPS monthly billing cycle');
    await this.billing.runBillingCycle();
    this.logger.log('VPS monthly billing cycle complete');
  }

  /** Check for suspension conditions at 02:00 every day. */
  @Cron('0 2 * * *')
  async handleSuspensionCheck(): Promise<void> {
    this.logger.log('Starting VPS suspension check');
    await this.billing.runSuspensionCheck();
    this.logger.log('VPS suspension check complete');
  }
}
