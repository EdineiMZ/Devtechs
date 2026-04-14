import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Partial update payload for a role. Unlike `CreateRoleDto` the `name`
 * is intentionally NOT editable — changing a role's canonical name
 * would break JWT claims and audit-log readability. Renames are a
 * separate, privileged operation we don't expose today.
 */
export class UpdateRoleDto {
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
   * Full replacement of the role's permission set. When present, the
   * service will compute the add/remove diff and apply it atomically.
   */
  @IsOptional()
  @IsArray({ message: 'permissionIds must be an array' })
  @ArrayUnique({ message: 'permissionIds must not contain duplicates' })
  @IsString({ each: true, message: 'each permissionId must be a string' })
  permissionIds?: string[];
}
