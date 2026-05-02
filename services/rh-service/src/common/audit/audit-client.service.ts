import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type AuditModule =
  | 'AUTH' | 'RH' | 'FINANCEIRO' | 'PROJETOS' | 'SUPORTE'
  | 'PAGAMENTOS' | 'LICENCAS' | 'DEVOPS' | 'DEVELOPER';

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  module: AuditModule;
  resourceId?: string | null;
  meta?: Record<string, unknown>;
  ipAddress?: string | null;
}

/**
 * Thin wrapper around the shared audit_logs table.
 * All services share the same Postgres database so they can write
 * audit entries directly — no HTTP round-trip to auth-service needed.
 * Best-effort: failures are logged but never bubble up to callers.
 */
@Injectable()
export class AuditClientService {
  private readonly logger = new Logger(AuditClientService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          module: input.module as any,
          resourceId: input.resourceId ?? null,
          meta: (input.meta ?? {}) as any,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `[AuditClient] Failed to write audit log [${input.action}@${input.module}]: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
