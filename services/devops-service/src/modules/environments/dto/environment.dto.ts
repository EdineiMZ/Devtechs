import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ENVIRONMENT_TYPES = [
  'PRODUCTION',
  'STAGING',
  'DEVELOPMENT',
] as const;
export type EnvironmentTypeLiteral = (typeof ENVIRONMENT_TYPES)[number];

export class CreateEnvironmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsEnum(ENVIRONMENT_TYPES)
  type!: EnvironmentTypeLiteral;

  @IsString()
  projectId!: string;

  @IsUrl({ require_protocol: true })
  url!: string;
}

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsEnum(ENVIRONMENT_TYPES)
  type?: EnvironmentTypeLiteral;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
