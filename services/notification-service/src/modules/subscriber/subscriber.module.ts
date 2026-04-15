import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NOTIFICATIONS_QUEUE } from '../queue/queue.constants';

import { RedisSubscriber } from './redis.subscriber';

/**
 * Re-registers the shared `notifications` queue so this module
 * can @InjectQueue without depending directly on QueueModule.
 * BullModule.registerQueue is idempotent — the same queue name
 * resolves to the same instance across modules.
 */
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  providers: [RedisSubscriber],
})
export class SubscriberModule {}
