import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const PLAN_INTERVALS = ['MONTHLY', 'YEARLY'] as const;

export class CreatePlanDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsEnum(PLAN_INTERVALS)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  interval!: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(PLAN_INTERVALS)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  interval?: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
