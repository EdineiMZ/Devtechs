import {
  IsNumberString,
  IsOptional,
  IsString,
  Length,
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
   * required contract ("exige senha atual para confirmar").
   */
  @IsOptional()
  @IsString({ message: 'code must be a string' })
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @IsNumberString({ no_symbols: true }, { message: 'code must contain only digits' })
  code?: string;
}
