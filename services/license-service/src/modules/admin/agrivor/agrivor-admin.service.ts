import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { ActivationService } from '../../activation/activation.service';

export type KeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface AgrivorKeyDto {
  id: string;
  customerId: string;
  modules: string[];
  status: KeyStatus;
  expiresAt: Date;
  issuedAt: Date;
  issuedBy: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
  lastHeartbeatAt: Date | null;
  lastValidatedAt: Date | null;
}

export interface AgrivorPaymentDto {
  id: string;
  mpPaymentId: string;
  customerId: string | null;
  action: string;
  mpStatus: string | null;
  result: unknown;
  processedAt: Date;
}

export interface AgrivorTelemetryDto {
  id: string;
  customerId: string;
  modules: string[];
  status: KeyStatus;
  expiresAt: Date;
  issuedAt: Date;
  revokedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastValidatedAt: Date | null;
  gracePeriodEndsAt: Date | null;
  isOnline: boolean;
}

function computeStatus(revokedAt: Date | null, expiresAt: Date): KeyStatus {
  if (revokedAt !== null) return 'REVOKED';
  if (expiresAt <= new Date()) return 'EXPIRED';
  return 'ACTIVE';
}

@Injectable()
export class AgrivorAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: ActivationService,
  ) {}

  async listKeys(status?: KeyStatus): Promise<AgrivorKeyDto[]> {
    const now = new Date();

    const where = status
      ? status === 'ACTIVE'
        ? { revokedAt: null as null, expiresAt: { gt: now } }
        : status === 'EXPIRED'
          ? { revokedAt: null as null, expiresAt: { lte: now } }
          : { revokedAt: { not: null as null } }
      : {};

    const keys = await this.prisma.activationKey.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
    });

    return keys.map((k) => ({
      id: k.id,
      customerId: k.customerId,
      modules: k.modules,
      status: computeStatus(k.revokedAt, k.expiresAt),
      expiresAt: k.expiresAt,
      issuedAt: k.issuedAt,
      issuedBy: k.issuedBy,
      revokedAt: k.revokedAt,
      revokedBy: k.revokedBy,
      revokeReason: k.revokeReason,
      lastHeartbeatAt: null,
      lastValidatedAt: null,
    }));
  }

  async issueKey(params: {
    customerId: string;
    modules: string[];
    expiresInDays: number;
  }) {
    return this.activation.issueKey({
      customerId: params.customerId,
      modules: params.modules,
      validityDays: params.expiresInDays,
      issuedBy: 'admin:agrivor',
    });
  }

  async revokeKey(id: string): Promise<void> {
    const key = await this.prisma.activationKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException(`Key ${id} not found`);
    await this.activation.revokeKey(id, 'admin:agrivor');
  }

  async renewKey(id: string, expiresInDays: number) {
    const key = await this.prisma.activationKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException(`Key ${id} not found`);

    return this.activation.issueKey({
      customerId: key.customerId,
      modules: key.modules,
      validityDays: expiresInDays,
      issuedBy: 'admin:agrivor:renew',
    });
  }

  async listPayments(customerId?: string): Promise<AgrivorPaymentDto[]> {
    const webhooks = await this.prisma.processedWebhook.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        mpStatus: { in: ['approved', 'cancelled', 'rejected'] },
      },
      orderBy: { processedAt: 'desc' },
    });

    return webhooks.map((w) => ({
      id: w.id,
      mpPaymentId: w.mpPaymentId,
      customerId: w.customerId,
      action: w.action,
      mpStatus: w.mpStatus,
      result: w.result,
      processedAt: w.processedAt,
    }));
  }

  async getTelemetry(): Promise<AgrivorTelemetryDto[]> {
    const keys = await this.prisma.activationKey.findMany({
      orderBy: { issuedAt: 'desc' },
    });

    const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000;
    const ONLINE_THRESHOLD_MS = 90 * 60 * 1000;

    return keys.map((k) => {
      const lastHeartbeatAt: Date | null = null;
      const lastValidatedAt: Date | null = null;
      const gracePeriodEndsAt = lastHeartbeatAt
        ? new Date(lastHeartbeatAt.getTime() + GRACE_PERIOD_MS)
        : null;
      const isOnline = lastHeartbeatAt
        ? Date.now() - lastHeartbeatAt.getTime() <= ONLINE_THRESHOLD_MS
        : false;

      return {
        id: k.id,
        customerId: k.customerId,
        modules: k.modules,
        status: computeStatus(k.revokedAt, k.expiresAt),
        expiresAt: k.expiresAt,
        issuedAt: k.issuedAt,
        revokedAt: k.revokedAt,
        lastHeartbeatAt,
        lastValidatedAt,
        gracePeriodEndsAt,
        isOnline,
      };
    });
  }
}
