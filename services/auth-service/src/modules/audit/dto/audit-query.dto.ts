import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsIP,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { AUDIT_MODULE_VALUES, type AuditModuleFilter } from './query-audit.dto';

/**
 * Query params for `GET /audit/logs`.
 *
 * `dateFrom` / `dateTo` are mandatory by spec — the audit table grows
 * fast and unbounded scans would page-bust the indexed by-time scan
 * we rely on. Cursor pagination uses the row id (cuid, sortable) and
 * createdAt together so consecutive pages stay stable even if new
 * rows are inserted while the user paginates.
 */
export class AuditQueryDto {
  @IsISO8601({}, { message: 'dateFrom must be an ISO-8601 timestamp' })
  @IsNotEmpty({ message: 'dateFrom is required' })
  dateFrom!: string;

  @IsISO8601({}, { message: 'dateTo must be an ISO-8601 timestamp' })
  @IsNotEmpty({ message: 'dateTo is required' })
  dateTo!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(AUDIT_MODULE_VALUES)
  module?: AuditModuleFilter;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsIP(undefined, { message: 'ipAddress must be a valid IP' })
  ipAddress?: string;

  /**
   * Cursor returned by the previous page (`nextCursor`). Opaque to the
   * client — internally it's just the last row's `id`.
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

/** Same shape as `AuditQueryDto` but without pagination fields. */
export class AuditExportDto {
  @IsISO8601()
  @IsNotEmpty()
  dateFrom!: string;

  @IsISO8601()
  @IsNotEmpty()
  dateTo!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(AUDIT_MODULE_VALUES)
  module?: AuditModuleFilter;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  /** Format selector — only `csv` for now; `json` reserved for a follow-up. */
  @IsOptional()
  @IsString()
  format?: 'csv' | 'json';
}
