import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  /**
   * Short, slug-like role name. We require a URL-safe format so the
   * name can be used in audit logs and JWT claims without escaping.
   */
  @ApiProperty({
    description:
      'Slug-style role name (URL-safe). Lowercased and trimmed server-side. ' +
      'Used in JWT claims and audit logs.',
    example: 'support-agent',
    minLength: 2,
    maxLength: 50,
    pattern: '^[a-z0-9][a-z0-9_-]*$',
  })
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @MaxLength(50, { message: 'name must be at most 50 characters long' })
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'name must be lowercase letters, digits, underscores, or dashes',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  name!: string;

  @ApiPropertyOptional({
    description: 'Free-form description shown in the admin UI.',
    example: 'Atende chamados de suporte e gerencia base de conhecimento.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(255, { message: 'description must be at most 255 characters long' })
  description?: string;

  @ApiPropertyOptional({
    description:
      'When true, members of this role must have a verified email before any ' +
      'permission gate lets them through.',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'requireEmailVerified must be a boolean' })
  requireEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'When true, members must have 2FA enabled.',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'require2FA must be a boolean' })
  require2FA?: boolean;

  /**
   * Permission CUIDs (from `GET /permissions`) to attach to this role.
   * Optional — a role with no permissions is valid but pointless.
   */
  @ApiPropertyOptional({
    description: 'Permission IDs (cuids from `GET /permissions`) to attach to the role.',
    example: ['cln9p1ab0001qe7zabc12345', 'cln9p1ab0002qe7zabc67890'],
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'permissionIds must be an array' })
  @ArrayUnique({ message: 'permissionIds must not contain duplicates' })
  @IsString({ each: true, message: 'each permissionId must be a string' })
  permissionIds?: string[];
}
