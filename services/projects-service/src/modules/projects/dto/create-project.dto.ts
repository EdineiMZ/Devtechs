import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const PROJECT_STATUSES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
] as const;
export type ProjectStatusLiteral = (typeof PROJECT_STATUSES)[number];

/**
 * Body for `POST /projects`.
 *
 * `ownerId` is required and must reference an existing User.
 * `clientId` is optional — internal projects have no client.
 *
 * The service additionally creates a default Board ("Main") with
 * three default Columns ("To Do", "In Progress", "Done") so the
 * project is immediately usable from the kanban view without an
 * extra setup step.
 */
export class CreateProjectDto {
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters long' })
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(PROJECT_STATUSES, {
    message: `status must be one of: ${PROJECT_STATUSES.join(', ')}`,
  })
  status?: ProjectStatusLiteral;

  @IsDateString({}, { message: 'startDate must be an ISO-8601 date (YYYY-MM-DD)' })
  startDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'endDate must be an ISO-8601 date (YYYY-MM-DD)' })
  endDate?: string;

  @IsString({ message: 'ownerId must be a string' })
  ownerId!: string;

  @IsOptional()
  @IsString({ message: 'clientId must be a string' })
  clientId?: string;

  /** Optional GitHub repository URL, e.g. "https://github.com/org/repo" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  githubRepo?: string;

  /** Overall project progress 0-100 (%) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
