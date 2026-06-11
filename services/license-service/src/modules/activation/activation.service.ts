import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

export interface IssueKeyParams {
  customerId: string;
  modules: string[];
  validityDays: number;
  issuedBy?: string;
}

export interface IssuedKey {
  keyId: string;
  jwt: string;
  customerId: string;
  modules: string[];
  issuedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class ActivationService implements OnModuleInit {
  private readonly logger = new Logger(ActivationService.name);
  private privateKeyPem: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const keyPath = this.config.get<string>('LICENSE_PRIVATE_KEY_PATH');
    const keyPem = this.config.get<string>('LICENSE_SIGNING_KEY');

    if (keyPem) {
      this.privateKeyPem = keyPem.replace(/\\n/g, '\n');
    } else if (keyPath) {
      try {
        this.privateKeyPem = readFileSync(keyPath, 'utf8');
      } catch (err) {
        this.logger.error(`Failed to load private key from ${keyPath}: ${String(err)}`);
      }
    } else {
      this.logger.warn(
        'LICENSE_SIGNING_KEY and LICENSE_PRIVATE_KEY_PATH are both unset — ' +
          'key issuance will fail at runtime',
      );
    }
  }

  async issueKey(params: IssueKeyParams): Promise<IssuedKey> {
    if (!this.privateKeyPem) {
      throw new ServiceUnavailableException(
        'Activation key signing is not configured (missing private key)',
      );
    }

    const { customerId, modules, validityDays, issuedBy = 'system' } = params;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityDays * 86_400_000);

    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
      'utf8',
    ).toString('base64url');

    const payload = Buffer.from(
      JSON.stringify({
        sub: customerId,
        modules,
        iss: 'szdevs',
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000),
      }),
      'utf8',
    ).toString('base64url');

    const signingInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer.sign(this.privateKeyPem, 'base64url');
    const jwt = `${signingInput}.${signature}`;

    const record = await this.prisma.activationKey.create({
      data: {
        customerId,
        jwt,
        modules,
        expiresAt,
        issuedBy,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'key_issued',
        keyId: record.id,
        customerId,
        modules,
        expiresAt: expiresAt.toISOString(),
        issuedBy,
      }),
    );

    return {
      keyId: record.id,
      jwt,
      customerId,
      modules,
      issuedAt: now,
      expiresAt,
    };
  }

  async revokeKey(keyId: string, revokedBy: string, reason?: string): Promise<void> {
    await this.prisma.activationKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date(), revokedBy, revokeReason: reason ?? null },
    });
    this.logger.log(JSON.stringify({ event: 'key_revoked', keyId, revokedBy, reason }));
  }
}
