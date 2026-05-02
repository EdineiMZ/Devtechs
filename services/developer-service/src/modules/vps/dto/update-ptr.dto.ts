import { IsIP, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for `PUT /vps/:id/ptr`. */
export class UpdatePtrDto {
  /** The IP address (IPv4 or IPv6) whose PTR record will be updated. */
  @IsIP()
  ipAddress!: string;

  /** The new PTR/reverse-DNS hostname (e.g. `mail.example.com`). */
  @IsString()
  @MinLength(4)
  @MaxLength(253)
  ptr!: string;
}
