import { IsJWT, IsNumberString, IsString, Length } from 'class-validator';

export class Verify2FADto {
  /** Short-lived JWT issued by /auth/login when the user has 2FA enabled. */
  @IsString({ message: 'tempToken must be a string' })
  @IsJWT({ message: 'tempToken must be a valid JWT' })
  tempToken!: string;

  /** Six-digit TOTP code shown by the authenticator app. */
  @IsString({ message: 'code must be a string' })
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @IsNumberString({ no_symbols: true }, { message: 'code must contain only digits' })
  code!: string;
}
