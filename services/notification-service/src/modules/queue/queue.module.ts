import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NotificationConsumer } from './notification.consumer';
import { NOTIFICATIONS_QUEUE } from './queue.constants';

/**
 * Registers the shared `notifications` queue and the consumer
 * worker. Exported so the SubscriberModule can @InjectQueue
 * without re-registering.
 */
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [NotificationConsumer],
  exports: [BullModule],
})
export class QueueModule {}
