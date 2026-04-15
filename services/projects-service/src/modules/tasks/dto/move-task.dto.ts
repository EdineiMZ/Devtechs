import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

/**
 * Body for `PUT /tasks/:id/column`.
 *
 * Drag-and-drop sends both the destination column id and the new
 * 0-based position within that column. The service handles every
 * order-recalculation case in one transaction:
 *
 *   - same column reorder: shift tasks between old and new positions
 *   - cross-column move:   close the gap in the source column,
 *                          shift the destination from `newOrder`
 *                          onwards, set the moved task's column +
 *                          order in one row update.
 */
export class MoveTaskDto {
  @IsString({ message: 'targetColumnId is required' })
  targetColumnId!: string;

  @Type(() => Number)
  @IsInt({ message: 'newOrder must be an integer' })
  @Min(0, { message: 'newOrder must be >= 0' })
  newOrder!: number;
}
