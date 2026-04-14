import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Body expected by `POST /auth/oauth/login`.
 *
 * Sent by the NextAuth `signIn` callback in `apps/web` after a
 * successful Google / GitHub OAuth dance. The request is gated by
 * `InternalSecretGuard` so only the frontend backend can post to it.
 *
 * We accept the two OAuth providers we wire in NextAuth today.
 * Adding a third later means extending this enum + the Prisma
 * `OAuthProvider` enum in the same migration.
 */
export const OAUTH_PROVIDERS = ['google', 'github'] as const;
export type OAuthProviderLiteral = (typeof OAUTH_PROVIDERS)[number];

export class OAuthLoginDto {
  @IsEnum(OAUTH_PROVIDERS, {
    message: `provider must be one of: ${OAUTH_PROVIDERS.join(', ')}`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  provider!: OAuthProviderLiteral;

  @IsString({ message: 'providerAccountId must be a string' })
  @MinLength(1, { message: 'providerAccountId is required' })
  @MaxLength(255, { message: 'providerAccountId must be at most 255 characters' })
  providerAccountId!: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;
}
