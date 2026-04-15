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

import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type TransactionCategoryLiteral,
  type TransactionStatusLiteral,
  type TransactionTypeLiteral,
} from './create-transaction.dto';

/** Body for `PUT /transactions/:id`. All fields optional. */
export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TRANSACTION_TYPES)
  type?: TransactionTypeLiteral;

  @IsOptional()
  @IsEnum(TRANSACTION_CATEGORIES)
  category?: TransactionCategoryLiteral;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(TRANSACTION_STATUSES)
  status?: TransactionStatusLiteral;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsString()
  costCenterId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
