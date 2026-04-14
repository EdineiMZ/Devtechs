import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * EmployeeStatus enum values, duplicated as a string tuple so the
 * HTTP layer doesn't have to import Prisma types (which would pull
 * the generated client into every DTO file). Keep in sync with
 * `EmployeeStatus` in schema.prisma.
 */
export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'DISMISSED'] as const;
export type EmployeeStatusLiteral = (typeof EMPLOYEE_STATUSES)[number];

/**
 * Query params for `GET /employees`.
 *
 * Pagination defaults to page 1, pageSize 50. Max pageSize is 200 so
 * a misbehaving client can't pull the entire org chart in one request.
 */
export class QueryEmployeesDto {
  @IsOptional()
  @IsEnum(EMPLOYEE_STATUSES, {
    message: `status must be one of: ${EMPLOYEE_STATUSES.join(', ')}`,
  })
  status?: EmployeeStatusLiteral;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  /** Free-text substring match against name + email. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
