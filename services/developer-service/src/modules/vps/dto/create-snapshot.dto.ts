import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for `POST /vps/:id/snapshots`. */
export class CreateSnapshotDto {
  /**
   * Human-readable label saved with the snapshot. The Hostinger API
   * itself doesn't require it, but having one makes the snapshot list
   * usable. Defaults server-side to `manual-<ISO date>` when absent.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;
}
