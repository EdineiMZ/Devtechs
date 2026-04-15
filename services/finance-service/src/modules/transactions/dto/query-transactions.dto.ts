import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type TransactionCategoryLiteral,
  type TransactionStatusLiteral,
  type TransactionTypeLiteral,
} from './create-transaction.dto';

/** Query string for `GET /transactions`. */
export class QueryTransactionsDto {
  @IsOptional()
  @IsEnum(TRANSACTION_TYPES)
  type?: TransactionTypeLiteral;

  @IsOptional()
  @IsEnum(TRANSACTION_CATEGORIES)
  category?: TransactionCategoryLiteral;

  @IsOptional()
  @IsEnum(TRANSACTION_STATUSES)
  status?: TransactionStatusLiteral;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

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

/**
 * Query string for `GET /transactions/summary` — DRE period filter.
 * Defaults to the current month when both fields are omitted.
 */
export class SummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Query string for `GET /transactions/cashflow`. */
export class CashflowQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  @Transform(({ value }) => (value === undefined ? 6 : Number(value)))
  months?: number;
}
