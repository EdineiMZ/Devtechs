import { Module } from '@nestjs/common';

import { TokenExpiryCron } from './token-expiry.cron';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  controllers: [TokensController],
  providers: [TokensService, TokenExpiryCron],
  exports: [TokensService],
})
export class TokensModule {}
