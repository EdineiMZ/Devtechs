import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body for `POST /employees`.
 *
 * `positionId` and `departmentId` are required because the Employee
 * row in Postgres references them with `onDelete: Restrict`. The
 * service layer additionally verifies that both exist before writing,
 * so a typo produces a clean 400 instead of a foreign-key crash.
 *
 * `userId` is optional — not every person on HR's roster has a
 * platform account (see schema comment on Employee.userId).
 */
export class CreateEmployeeDto {
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @MaxLength(120, { message: 'name must be at most 120 characters long' })
  @Matches(/^[^<>'"&]*$/, { message: 'name must not contain HTML characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254, { message: 'email must be at most 254 characters long' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsOptional()
  @IsString({ message: 'phone must be a string' })
  @MaxLength(30)
  phone?: string;

  /**
   * CPF — Brazilian taxpayer id. We accept the digits-only form
   * (11 numeric characters) to make server-side validation trivial
   * and avoid ambiguity about whether punctuation is present. The
   * admin UI is responsible for stripping masks before submitting.
   */
  @IsString({ message: 'cpf must be a string' })
  @Length(11, 11, { message: 'cpf must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'cpf must contain only digits' })
  cpf!: string;

  @IsDateString({}, { message: 'birthDate must be an ISO-8601 date (YYYY-MM-DD)' })
  birthDate!: string;

  @IsDateString({}, { message: 'hireDate must be an ISO-8601 date (YYYY-MM-DD)' })
  hireDate!: string;

  @IsString({ message: 'positionId must be a string' })
  @MinLength(1)
  positionId!: string;

  @IsString({ message: 'departmentId must be a string' })
  @MinLength(1)
  departmentId!: string;

  @IsOptional()
  @IsString({ message: 'managerId must be a string' })
  managerId?: string;

  @IsOptional()
  @IsString({ message: 'userId must be a string' })
  userId?: string;

  /// Individual salary in BRL (Reais). Optional — if not provided,
  /// defaults to the Position's salary band (if set).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'salary must be a valid monetary value' })
  @Min(0, { message: 'salary must be >= 0' })
  salary?: number;
}
