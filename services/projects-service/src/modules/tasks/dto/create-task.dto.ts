import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Tuples mirror the Prisma enums so the DTO file doesn't pull in
 * the generated client. Keep in sync with schema.prisma.
 */
export const TASK_TYPES = ['STORY', 'BUG', 'TASK', 'EPIC'] as const;
export type TaskTypeLiteral = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriorityLiteral = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
] as const;
export type TaskStatusLiteral = (typeof TASK_STATUSES)[number];

/**
 * Body for `POST /tasks`.
 *
 * The service appends the new task to the END of the target column
 * by computing the current max order + 1, so callers don't need to
 * supply an `order` value. The default column is the FIRST column
 * of the project's primary board if none is provided explicitly.
 */
export class CreateTaskDto {
  @IsString()
  projectId!: string;

  /** Optional — defaults to the first column on the project's board. */
  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(TASK_TYPES)
  type?: TaskTypeLiteral;

  @IsOptional()
  @IsEnum(TASK_PRIORITIES)
  priority?: TaskPriorityLiteral;

  @IsString()
  reporterId!: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  estimatedHours?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Free-form labels. Up to 50 per task to keep payloads sane. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  labels?: string[];

  /** Subtask parent. When set, the parent must belong to the same project. */
  @IsOptional()
  @IsString()
  parentId?: string;
}
