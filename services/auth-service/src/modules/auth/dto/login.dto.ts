import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Email address used at sign-up. Trimmed and lowercased server-side.',
    example: 'admin@SZDevs.com',
    maxLength: 254,
    format: 'email',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254, { message: 'email must be at most 254 characters long' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({
    description: 'Plaintext password â€” must be 8-128 characters.',
    example: 'Admin@SZDevs2026',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsString({ message: 'password must be a string' })
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(128, { message: 'password must be at most 128 characters long' })
  password!: string;
}
