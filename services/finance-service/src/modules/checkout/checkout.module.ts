import { Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';

import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [RedisModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
