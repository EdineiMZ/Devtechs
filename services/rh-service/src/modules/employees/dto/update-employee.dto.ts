import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { EMPLOYEE_STATUSES, type EmployeeStatusLiteral } from './query-employees.dto';

/**
 * Body for `PUT /employees/:id`.
 *
 * Every field is optional so callers can patch a single attribute.
 * The service layer computes the delta and rejects unknown
 * positionId / departmentId / managerId values before writing.
 *
 * `cpf` is editable for data-correction cases (a typo on onboarding),
 * but it's still unique in the database so attempting to reuse
 * another employee's CPF produces a 409 Conflict from the service.
 *
 * Note on `status`: setting it via PUT is allowed but the canonical
 * way to dismiss an employee is `DELETE /employees/:id` (soft delete
 * that also sets `dismissDate`). Leaving status editable lets HR flip
 * between `ACTIVE` and `ON_LEAVE` without a dedicated endpoint.
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(11, 11)
  @Matches(/^\d{11}$/, { message: 'cpf must contain only digits' })
  cpf?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsDateString()
  dismissDate?: string;

  @IsOptional()
  @IsString()
  positionId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsEnum(EMPLOYEE_STATUSES, {
    message: `status must be one of: ${EMPLOYEE_STATUSES.join(', ')}`,
  })
  status?: EmployeeStatusLiteral;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salary?: number;
}
