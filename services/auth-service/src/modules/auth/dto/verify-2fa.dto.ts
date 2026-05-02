import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNumberString, IsString, Length } from 'class-validator';

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

  /** Six-digit TOTP code shown by the authenticator app. */
  @ApiProperty({
    description: 'Six-digit TOTP code shown by the authenticator app (Google Authenticator, 1Password…).',
    example: '482917',
    minLength: 6,
    maxLength: 6,
    pattern: '^[0-9]{6}$',
  })
  @IsString({ message: 'code must be a string' })
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @IsNumberString({ no_symbols: true }, { message: 'code must contain only digits' })
  code!: string;
}
