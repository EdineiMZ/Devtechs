import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { AuditService } from './audit.service';
import type { PaginatedAuditResponse } from './dto/audit-response.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

/**
 * Admin-only endpoint for querying the audit log.
 *
 * Stacked guards:
 *   1. `JwtAuthGuard` (global) — valid access token
 *   2. `RolesGuard` + `@Roles('admin')` — user must have the `admin` role
 *
 * `@SkipThrottle()` because admins scrolling pagination shouldn't
 * trip the 100/min default limit.
 */
@Controller('auth/audit')
@UseGuards(RolesGuard)
@Roles('admin')
@SkipThrottle()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  list(@Query() query: QueryAuditDto): Promise<PaginatedAuditResponse> {
    return this.auditService.query(query);
  }
}
