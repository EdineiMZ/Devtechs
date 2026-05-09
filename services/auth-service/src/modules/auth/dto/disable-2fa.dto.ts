import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class Disable2FADto {
  /** Current password — required so a stolen access token alone cannot disable 2FA. */
  @IsString({ message: 'currentPassword must be a string' })
  @MinLength(8, { message: 'currentPassword must be at least 8 characters long' })
  @MaxLength(128, { message: 'currentPassword must be at most 128 characters long' })
  currentPassword!: string;

  /**
   * Optional TOTP code. When provided, we verify it alongside the password for
   * extra safety; when absent, the password alone is enough, which matches the
   * required contract ("exige senha atual para confirmar"). Accepts the digits
   * with optional whitespace/dashes — the service normalises before verifying.
   */
  @IsOptional()
  @IsString({ message: 'code must be a string' })
  @MaxLength(12, { message: 'code is too long' })
  @Matches(/^[\d\s-]{6,12}$/, { message: 'code must be a 6-digit numeric code' })
  code?: string;
}
