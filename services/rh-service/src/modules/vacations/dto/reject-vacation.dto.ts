import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `PUT /vacations/:id/reject`.
 *
 * The rejection reason is required and surfaced both to the employee
 * (via the `rh:vacation:rejected` email) and in the audit trail, so
 * we enforce a minimum length to prevent one-word drive-by rejections.
 */
export class RejectVacationDto {
  @IsString({ message: 'reason is required' })
  @MinLength(5, { message: 'reason must be at least 5 characters' })
  @MaxLength(1000, { message: 'reason must be at most 1000 characters' })
  reason!: string;
}
