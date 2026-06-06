import { IsString, Matches, MaxLength } from 'class-validator';

export class Enable2FADto {
  /**
   * Six-digit TOTP code shown by the authenticator app.
   *
   * Accepts the digits with optional whitespace/dashes ("123 456",
   * "123-456", " 123456 ") — the service normalises before verifying
   * with otplib. Capped at 12 chars so a malformed payload can't bloat.
   */
  @IsString({ message: 'code must be a string' })
  @MaxLength(12, { message: 'code is too long' })
  @Matches(/^[\d\s-]{6,12}$/, { message: 'code must be a 6-digit numeric code' })
  code!: string;
}
