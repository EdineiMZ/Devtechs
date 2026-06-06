import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Supported values for the `module` filter. Keep in sync with the
 * `PermissionModule` enum in Prisma — duplicated here so the DTO is
 * self-contained and doesn't pull runtime Prisma types into the HTTP layer.
 */
export const AUDIT_MODULE_VALUES = [
  'AUTH',
  'RH',
  'FINANCEIRO',
  'PROJETOS',
  'SUPORTE',
  'PAGAMENTOS',
  'LICENCAS',
  'DEVOPS',
  'DEVELOPER',
  'INTEGRATIONS',
] as const;

export type AuditModuleFilter = (typeof AUDIT_MODULE_VALUES)[number];

export class QueryAuditDto {
  @IsOptional()
  @IsString({ message: 'userId must be a string' })
  userId?: string;

  @IsOptional()
  @IsEnum(AUDIT_MODULE_VALUES, {
    message: `module must be one of: ${AUDIT_MODULE_VALUES.join(', ')}`,
  })
  module?: AuditModuleFilter;

  @IsOptional()
  @IsString({ message: 'action must be a string' })
  action?: string;

  /** Inclusive lower bound for `createdAt`. ISO-8601 format. */
  @IsOptional()
  @IsISO8601({}, { message: 'from must be an ISO-8601 timestamp' })
  from?: string;

  /** Inclusive upper bound for `createdAt`. ISO-8601 format. */
  @IsOptional()
  @IsISO8601({}, { message: 'to must be an ISO-8601 timestamp' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be >= 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be >= 1' })
  @Max(200, { message: 'pageSize must be <= 200' })
  pageSize?: number;
}
