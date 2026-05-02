import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Body for `POST /vps`. Attaches an existing Hostinger VM to an internal
 * client. The VM itself must already exist on the Hostinger side — this
 * endpoint never provisions hardware, it only records the link.
 */
export class AttachVpsDto {
  /** Opaque ID returned by the Hostinger API for the VM. */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  vmId!: string;

  /** Internal user (clientId) that owns this VPS. FK to `users.id`. */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  clientId!: string;

  /** Optional project this VPS belongs to. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string;

  /**
   * Operator-side label. Free-form, shown in the admin UI list. Falls
   * back to the Hostinger hostname if omitted.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  /** Optional internal notes (renewals, contacts, etc.). Not exposed to the client. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** Monthly billing price in BRL. Set to enable automatic monthly invoices. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monthlyPrice?: number;

  /** Day-of-month (1–28) to generate the monthly invoice. Default: 1. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  billingDayOfMonth?: number;

  /** Grace period in days after invoice due-date before VPS is suspended. Default: 3. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  suspendAfterDays?: number;
}
