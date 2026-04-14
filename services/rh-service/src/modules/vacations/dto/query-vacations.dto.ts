import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { VACATION_TYPES, type VacationTypeLiteral } from './create-vacation.dto';

export const VACATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type VacationStatusLiteral = (typeof VACATION_STATUSES)[number];

/**
 * Query params for `GET /vacations`.
 *
 * All filters are optional — omitting everything returns the whole
 * list across the company (paginated). HR dashboards typically call
 * this with no filters and paginate; employee self-service filters
 * to `?employeeId=<own-id>` so they only see their own history.
 *
 * `dateRange` is implemented as two separate `from`/`to` params
 * (inclusive) which match the underlying [startDate, endDate] fields:
 * we return requests whose RANGE intersects the query window, so
 * searching "April 2026" surfaces requests that span March-April too.
 */
export class QueryVacationsDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(VACATION_STATUSES, {
    message: `status must be one of: ${VACATION_STATUSES.join(', ')}`,
  })
  status?: VacationStatusLiteral;

  @IsOptional()
  @IsEnum(VACATION_TYPES, {
    message: `type must be one of: ${VACATION_TYPES.join(', ')}`,
  })
  type?: VacationTypeLiteral;

  /** Inclusive lower bound of the overlap window. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Inclusive upper bound of the overlap window. */
  @IsOptional()
  @IsDateString()
  to?: string;

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
