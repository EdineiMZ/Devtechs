import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

import {
  AUDIT_KEY,
  type AuditMetadata,
} from '../../common/decorators/audit.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

import { AuditService } from './audit.service';

interface RequestWithUser extends Request {
  user?: CurrentUserPayload;
}

/**
 * Captures audit trail entries for routes marked with `@Audit()`.
 *
 * Design notes
 * ------------
 * - Registered once globally via `APP_INTERCEPTOR` in `AppModule`, so
 *   adding auditing to a new route is as simple as `@Audit('ACTION')`
 *   with no extra wiring.
 * - Pass-through when the metadata is absent — you pay zero cost for
 *   untagged routes.
 * - Success path is the default. Failures are only recorded when the
 *   handler explicitly opts in via `@Audit('X', 'AUTH', true)`, to
 *   avoid duplicating richer service-level error audits.
 * - The audit write is fire-and-forget inside `AuditService.log()`
 *   (errors are swallowed and logged), so it can never break the
 *   user-facing response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithUser>();
    const user = req.user;
    const ipAddress = req.ip ?? null;
    const method = req.method;
    const path = req.originalUrl;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.auditService.log({
            userId: user?.id ?? null,
            action: metadata.action,
            module: metadata.module ?? 'AUTH',
            meta: {
              method,
              path,
              durationMs: Date.now() - startedAt,
              userEmail: user?.email,
            },
            ipAddress,
          });
        },
        error: (err: unknown) => {
          if (!metadata.auditOnError) return;
          const reason = err instanceof Error ? err.message : String(err);
          void this.auditService.log({
            userId: user?.id ?? null,
            action: `${metadata.action}_FAILED`,
            module: metadata.module ?? 'AUTH',
            meta: {
              method,
              path,
              durationMs: Date.now() - startedAt,
              reason,
            },
            ipAddress,
          });
        },
      }),
    );
  }
}
