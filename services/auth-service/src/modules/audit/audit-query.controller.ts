import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';

import { CsvExportService } from '../../common/csv/csv-export.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';

import {
  AuditExportDto,
  AuditQueryDto,
} from './dto/audit-query.dto';
import type { AuditLogItem } from './dto/audit-response.dto';
import {
  AuditService,
  type AuditCursorPage,
  type AuditStats,
  type SecurityReport,
  type UserTimelineItem,
} from './audit.service';

/**
 * Global audit query surface. Mounted at `/audit` (the legacy
 * `AuditController` at `/auth/audit` stays in place for backwards
 * compatibility with existing admin tooling).
 *
 * Guards:
 *   - `JwtAuthGuard` (global, registered in AppModule) → valid token
 *   - `PermissionGuard` + `@RequirePermission` per route
 *
 * Endpoint-specific permissions:
 *   - `GET /audit/logs`              → dev:logs:view
 *   - `GET /audit/logs/export`       → dev:logs:view
 *   - `GET /audit/stats`             → dev:logs:view
 *   - `GET /audit/users/:id/timeline`→ dev:logs:view
 *   - `GET /audit/security-report`   → dev:config:edit
 */
@Controller('audit')
@UseGuards(PermissionGuard)
@SkipThrottle()
export class AuditQueryController {
  constructor(
    private readonly auditService: AuditService,
    private readonly csv: CsvExportService,
  ) {}

  @Get('logs')
  @RequirePermission('dev:logs:view')
  @HttpCode(HttpStatus.OK)
  list(@Query() query: AuditQueryDto): Promise<AuditCursorPage> {
    return this.auditService.cursorQuery(query);
  }

  @Get('logs/export')
  @RequirePermission('dev:logs:view')
  async export(
    @Query() query: AuditExportDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Buffer> {
    const rows = await this.auditService.exportRows(query);

    const buf = this.csv.toBuffer<AuditLogItem>(rows, [
      { key: 'createdAt', label: 'Data' },
      { key: 'userId', label: 'Usuário' },
      { key: 'action', label: 'Ação' },
      { key: 'module', label: 'Módulo' },
      { key: 'resourceId', label: 'Recurso' },
      { key: 'ipAddress', label: 'IP' },
      {
        key: 'meta',
        label: 'Detalhes',
        format: (v) => (v ? JSON.stringify(v) : ''),
      },
    ]);

    const filenameStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-logs-${filenameStamp}.csv"`,
    );
    res.setHeader('Content-Length', String(buf.length));
    return buf;
  }

  @Get('stats')
  @RequirePermission('dev:logs:view')
  stats(): Promise<AuditStats> {
    return this.auditService.stats();
  }

  @Get('users/:userId/timeline')
  @RequirePermission('dev:logs:view')
  timeline(@Param('userId') userId: string): Promise<UserTimelineItem[]> {
    return this.auditService.userTimeline(userId);
  }

  @Get('security-report')
  @RequirePermission('dev:config:edit')
  securityReport(): Promise<SecurityReport> {
    return this.auditService.securityReport();
  }
}
