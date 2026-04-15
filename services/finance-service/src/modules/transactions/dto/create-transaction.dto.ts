import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
export type TransactionTypeLiteral = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_CATEGORIES = [
  'SALARY',
  'SERVICE',
  'PRODUCT',
  'TAX',
  'INFRA',
  'MARKETING',
  'OTHER',
] as const;
export type TransactionCategoryLiteral = (typeof TRANSACTION_CATEGORIES)[number];

export const TRANSACTION_STATUSES = [
  'PENDING',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;
export type TransactionStatusLiteral = (typeof TRANSACTION_STATUSES)[number];

/**
 * Body for `POST /transactions`. `amount` is always positive — the
 * sign is implied by `type` (INCOME vs EXPENSE), never by the value
 * itself. The service writes the row with createdBy set from the
 * JWT subject, so the caller never supplies that field.
 */
export class CreateTransactionDto {
  @IsEnum(TRANSACTION_TYPES, {
    message: `type must be one of: ${TRANSACTION_TYPES.join(', ')}`,
  })
  type!: TransactionTypeLiteral;

  @IsEnum(TRANSACTION_CATEGORIES, {
    message: `category must be one of: ${TRANSACTION_CATEGORIES.join(', ')}`,
  })
  category!: TransactionCategoryLiteral;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive({ message: 'amount must be positive — direction is encoded in type' })
  amount!: number;

  @IsDateString({}, { message: 'date must be an ISO-8601 date (YYYY-MM-DD)' })
  date!: string;

  @IsOptional()
  @IsEnum(TRANSACTION_STATUSES)
  status?: TransactionStatusLiteral;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
