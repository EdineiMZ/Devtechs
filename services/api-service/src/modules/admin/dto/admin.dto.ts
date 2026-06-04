import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum IpBindingMode {
  DISABLED = 'DISABLED',
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export class RateLimitDto {
  @ApiProperty({ example: 60, description: 'Max requests per minute' })
  @IsInt()
  @Min(1)
  perMinute!: number;

  @ApiProperty({ example: 1000, description: 'Max requests per hour' })
  @IsInt()
  @Min(1)
  perHour!: number;

  @ApiProperty({ example: 10000, description: 'Max requests per day' })
  @IsInt()
  @Min(1)
  perDay!: number;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My Integration', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: ['tickets:read', 'projects:read'],
    description: 'Permission scopes granted to this key',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @ApiProperty({ enum: IpBindingMode, default: IpBindingMode.DISABLED })
  @IsEnum(IpBindingMode)
  ipBinding!: IpBindingMode;

  @ApiPropertyOptional({
    example: ['203.0.113.5'],
    description: 'Allowed IPs when ipBinding = MANUAL',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  boundIps?: string[];

  @ApiProperty({ type: RateLimitDto })
  @ValidateNested()
  @Type(() => RateLimitDto)
  rateLimit!: RateLimitDto;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    description: 'ISO 8601 expiry date. Omit for no expiry.',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @ApiProperty({ example: 'My Integration', minLength: 3, maxLength: 100 })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ enum: IpBindingMode })
  @IsOptional()
  @IsEnum(IpBindingMode)
  ipBinding?: IpBindingMode;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  boundIps?: string[];

  @ApiPropertyOptional({ type: RateLimitDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitDto)
  rateLimit?: RateLimitDto;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class RevokeApiKeyDto {
  @ApiPropertyOptional({ example: 'Compromised credential', description: 'Reason for revocation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by event type', example: 'REQUEST_OK' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;
}
