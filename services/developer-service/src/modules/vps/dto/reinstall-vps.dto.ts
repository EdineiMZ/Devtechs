import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

/** Body for `POST /vps/:id/reinstall`. */
export class ReinstallVpsDto {
  /** OS template ID obtained from `GET /vps/resources/os-templates`. */
  @IsInt()
  @IsPositive()
  templateId!: number;

  /** Optional SSH key IDs to inject into the reinstalled OS. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sshKeyIds?: number[];
}
