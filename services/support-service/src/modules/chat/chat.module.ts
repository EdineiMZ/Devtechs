import { Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module';

import { SupportGateway } from './support.gateway';
import { TypingIndicatorService } from './typing-indicator.service';

/**
 * Chat module — the Socket.io gateway + the typing-indicator
 * service. Imports TicketsModule so SupportGateway can inject
 * TicketsService without triggering a circular dependency
 * (Tickets → Chat is one-way: the REST layer can also push
 * events via the exported gateway, but Tickets doesn't import
 * anything from Chat at module-graph level).
 */
@Module({
  imports: [TicketsModule],
  providers: [SupportGateway, TypingIndicatorService],
  exports: [SupportGateway],
})
export class ChatModule {}
