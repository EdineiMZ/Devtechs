import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const COUPON_TYPES = ['PERCENTAGE', 'FIXED'] as const;

export class CreateCouponDto {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  discount!: number;

  @IsEnum(COUPON_TYPES)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  type!: 'PERCENTAGE' | 'FIXED';

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}
