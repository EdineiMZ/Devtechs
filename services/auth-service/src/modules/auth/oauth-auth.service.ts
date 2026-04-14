import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '@devtechs/database';

import { AuditAction } from '../../common/constants/audit-actions';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { AuthService, type LoginContext } from './auth.service';
import type { LoginSuccessResponse } from './dto/auth-response.dto';
import type { OAuthProviderLiteral } from './dto/oauth-login.dto';

/**
 * OAuth account-linking + login.
 *
 * Flow:
 *   1. Look up the `OAuthAccount` row for (provider, providerAccountId).
 *      Already-linked users skip every subsequent step and go straight
 *      to `completeLogin()`.
 *
 *   2. If there's no matching OAuth account, look for a local user
 *      by email. If one exists, link the OAuth account to that user
 *      and log them in. This is where account linking happens —
 *      e.g. a user who originally signed up with email/password can
 *      later add Google without creating a second account.
 *
 *   3. If no local user exists, create one. OAuth-registered users
 *      get `emailVerified = true` (the provider has already done
 *      that check for us), a random password hash they can reset
 *      later, and the `member` role on first login.
 *
 *   4. In all three cases we call `AuthService.completeLogin()` so
 *      session rows, token issuing, lastLoginAt, and LOGIN_SUCCESS
 *      audit writes happen in exactly one place.
 */

export interface OAuthLoginInput {
  provider: OAuthProviderLiteral;
  providerAccountId: string;
  email: string;
  name?: string;
}

const PROVIDER_ENUM: Record<OAuthProviderLiteral, 'GOOGLE' | 'GITHUB'> = {
  google: 'GOOGLE',
  github: 'GITHUB',
};

@Injectable()
export class OAuthAuthService {
  private readonly logger = new Logger(OAuthAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async loginOrLink(
    input: OAuthLoginInput,
    ctx: LoginContext,
  ): Promise<LoginSuccessResponse> {
    const providerEnum = PROVIDER_ENUM[input.provider];
    if (!providerEnum) {
      throw new BadRequestException('Unsupported provider');
    }

    // ---- 1. Already-linked OAuth account? ----
    const existingLink = await this.prisma.oAuthAccount.findUnique({
      where: { providerAccountId: input.providerAccountId },
      include: { user: true },
    });

    if (existingLink) {
      const user = existingLink.user;
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }
      return this.authService.completeLogin(user.id, ctx);
    }

    // ---- 2. Existing user by email → link new provider ----
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      if (existingUser.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      await this.prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: providerEnum,
          providerAccountId: input.providerAccountId,
        },
      });

      await this.auditService.log({
        userId: existingUser.id,
        action: 'OAUTH_LINKED',
        module: 'AUTH',
        meta: { provider: input.provider, email: existingUser.email },
        ipAddress: ctx.ipAddress ?? null,
      });

      this.logger.log(
        `Linked ${input.provider} to existing user ${existingUser.email} (${existingUser.id})`,
      );
      return this.authService.completeLogin(existingUser.id, ctx);
    }

    // ---- 3. Brand new user → create + link + log in ----
    // Random password hash so the row is valid but the password
    // cannot be used for credential login until the user resets it.
    const randomPassword = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name ?? input.email.split('@')[0] ?? 'Usuário',
          email: input.email,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
          oauthAccounts: {
            create: {
              provider: providerEnum,
              providerAccountId: input.providerAccountId,
            },
          },
        },
      });

      // Attach the default `member` role so newly-created OAuth
      // users have the same baseline as credential registrations.
      // Fail soft if the role is missing (seed not yet run).
      const memberRole = await tx.role.findUnique({
        where: { name: 'member' },
        select: { id: true },
      });
      if (memberRole) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: memberRole.id },
        });
      }

      return user;
    });

    await this.auditService.log({
      userId: created.id,
      action: AuditAction.REGISTER,
      module: 'AUTH',
      resourceId: created.id,
      meta: {
        email: created.email,
        provider: input.provider,
        via: 'oauth',
      },
      ipAddress: ctx.ipAddress ?? null,
    });

    this.logger.log(
      `Created OAuth user ${created.email} via ${input.provider} (${created.id})`,
    );

    return this.authService.completeLogin(created.id, ctx);
  }
}
