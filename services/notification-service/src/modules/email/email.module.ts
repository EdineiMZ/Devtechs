import { Global, Module } from '@nestjs/common';

import { RedisModule } from '../../redis/redis.module';
import { EmailService } from './email.service';

@Global()
@Module({
  imports: [RedisModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
