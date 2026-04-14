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
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @MaxLength(50, { message: 'name must be at most 50 characters long' })
  @Matches(/^[a-z0-9][a-z0-9_-]*$/, {
    message: 'name must be lowercase letters, digits, underscores, or dashes',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  name!: string;

  @IsOptional()
  @IsString({ message: 'description must be a string' })
  @MaxLength(255, { message: 'description must be at most 255 characters long' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'requireEmailVerified must be a boolean' })
  requireEmailVerified?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'require2FA must be a boolean' })
  require2FA?: boolean;

  /**
   * Permission CUIDs (from `GET /permissions`) to attach to this role.
   * Optional — a role with no permissions is valid but pointless.
   */
  @IsOptional()
  @IsArray({ message: 'permissionIds must be an array' })
  @ArrayUnique({ message: 'permissionIds must not contain duplicates' })
  @IsString({ each: true, message: 'each permissionId must be a string' })
  permissionIds?: string[];
}
