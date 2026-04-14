import { IsHexadecimal, IsString, Length } from 'class-validator';

/**
 * Query-string DTO for `GET /auth/email/verify?token=...`.
 *
 * The token is produced by `crypto.randomBytes(32).toString('hex')`,
 * which yields exactly 64 lowercase hex characters.
 */
export class VerifyEmailQueryDto {
  @IsString({ message: 'token must be a string' })
  @Length(64, 64, { message: 'token must be exactly 64 characters long' })
  @IsHexadecimal({ message: 'token must be a hexadecimal string' })
  token!: string;
}
