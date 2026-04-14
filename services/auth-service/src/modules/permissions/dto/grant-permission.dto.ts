import { IsString } from 'class-validator';

export class GrantPermissionDto {
  /**
   * Permission CUID to grant as an extra, individual permission on a
   * user (on top of whatever their roles already provide).
   */
  @IsString({ message: 'permissionId must be a string' })
  permissionId!: string;
}
