import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Body for `PATCH /auth/me` — the only fields a user can mutate
 * about themselves are `name` and `avatarUrl`. Email changes go
 * through a separate verified flow (not in scope here), and roles
 * are admin-only.
 *
 * Both fields are optional individually; the controller rejects an
 * empty body to avoid degenerate audit-log entries.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'name deve ser uma string' })
  @MinLength(2, { message: 'name deve ter ao menos 2 caracteres' })
  @MaxLength(120, { message: 'name deve ter no máximo 120 caracteres' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'avatarUrl deve ser uma URL http(s) válida' },
  )
  @MaxLength(500, { message: 'avatarUrl deve ter no máximo 500 caracteres' })
  avatarUrl?: string;
}
