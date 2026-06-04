import { Module } from '@nestjs/common';

import { FinanceModule } from '../finance/finance.module';
import { MeModule } from '../me/me.module';
import { ProjectsModule } from '../projects/projects.module';
import { TicketsModule } from '../tickets/tickets.module';

/**
 * Aggregates all public v1 API modules under a single import.
 * This module is imported by AppModule and does not add any extra
 * controllers or providers of its own.
 */
@Module({
  imports: [TicketsModule, ProjectsModule, FinanceModule, MeModule],
})
export class ApiV1Module {}
