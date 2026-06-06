import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { MeController } from './me.controller';

@Module({
  controllers: [MeController],
  providers: [ApiKeyGuard],
})
export class MeModule {}
