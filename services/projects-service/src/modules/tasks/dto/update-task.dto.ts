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

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  type TaskPriorityLiteral,
  type TaskStatusLiteral,
  type TaskTypeLiteral,
} from './create-task.dto';

/**
 * Partial-update body for `PUT /tasks/:id`. Every field optional.
 *
 * Includes `columnId` so a generic update can also move tasks
 * between columns — but for drag-and-drop the dedicated
 * `PUT /tasks/:id/column` endpoint is more efficient because it
 * additionally renumbers the affected columns inside one
 * transaction.
 */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

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

  @IsOptional()
  @IsEnum(TASK_STATUSES)
  status?: TaskStatusLiteral;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  estimatedHours?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsString()
  parentId?: string;
}
