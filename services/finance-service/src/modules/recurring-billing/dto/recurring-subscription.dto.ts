import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecurringSubscriptionItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;
}

export class CreateRecurringSubscriptionDto {
  @IsString()
  clientId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  billingDay!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  billingDueDays?: number;

  @IsDateString()
  nextBillingDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringSubscriptionItemDto)
  items!: RecurringSubscriptionItemDto[];
}

export class UpdateRecurringSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  billingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  billingDueDays?: number;

  @IsOptional()
  @IsDateString()
  nextBillingDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringSubscriptionItemDto)
  items?: RecurringSubscriptionItemDto[];
}

export class CancelRecurringSubscriptionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  /** If true, cancel immediately (endsAt = now). Default: end of current period. */
  @IsOptional()
  immediate?: boolean;
}
