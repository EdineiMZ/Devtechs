import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, Matches, MaxLength } from 'class-validator';

export class Verify2FADto {
  /** Short-lived JWT issued by /auth/login when the user has 2FA enabled. */
  @ApiProperty({
    description:
      'Temporary JWT returned by `POST /auth/login` when the user has 2FA on. Valid for ~5 minutes.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW9kbGtyaGUuLi4ifQ.AbCdEf',
    format: 'jwt',
  })
  @IsString({ message: 'tempToken must be a string' })
  @IsJWT({ message: 'tempToken must be a valid JWT' })
  tempToken!: string;

  /**
   * Six-digit TOTP code shown by the authenticator app. Accepts the
   * digits with optional whitespace/dashes ("123 456", "123-456",
   * " 123456 ") — the service normalises before verifying with otplib.
   */
  @ApiProperty({
    description:
      'TOTP code do app autenticador (Google Authenticator, 1Password…). Espaços e hífens são tolerados.',
    example: '482917',
    minLength: 6,
    maxLength: 12,
    pattern: '^[\\d\\s-]{6,12}$',
  })
  @IsString({ message: 'code must be a string' })
  @MaxLength(12, { message: 'code is too long' })
  @Matches(/^[\d\s-]{6,12}$/, { message: 'code must be a 6-digit numeric code' })
  code!: string;
}
