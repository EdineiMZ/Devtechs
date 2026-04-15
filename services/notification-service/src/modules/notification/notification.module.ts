import { Global, Module } from '@nestjs/common';

import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

/**
 * Global so the BullMQ consumer and the Redis subscriber can
 * both inject NotificationService / NotificationGateway without
 * a local re-import — matches the pattern auth-service uses for
 * shared infra services.
 */
@Global()
@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
