import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Protects service-to-service endpoints that the public internet
 * must never call directly.
 *
 * The caller (the Next.js `apps/web` server) sends a shared secret
 * via the `X-Internal-Secret` header. The guard compares it
 * constant-time against `AUTH_INTERNAL_SECRET` from the config. If
 * the secret is unset OR the header doesn't match, we 403 the request.
 *
 * This is intentionally simpler than a full JWT or mTLS — it's a
 * single shared credential that only exists on machines the ops
 * team controls. Leaks would let an attacker forge OAuth logins;
 * rotate the secret and every instance restart picks it up.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('AUTH_INTERNAL_SECRET');
    if (!expected) {
      // Fail closed — deployments that forget to configure the
      // secret should not silently open the endpoint to the world.
      throw new ForbiddenException({
        statusCode: 403,
        error: 'InternalSecretNotConfigured',
        message: 'Internal endpoints are disabled on this instance',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-secret'];
    const providedStr = Array.isArray(provided) ? provided[0] : provided;

    if (!providedStr || !timingSafeCompare(providedStr, expected)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'InvalidInternalSecret',
        message: 'Invalid internal secret',
      });
    }

    return true;
  }
}

/**
 * Constant-time string comparison. Avoids the classic timing side
 * channel where an attacker brute-forces a secret one character at
 * a time by measuring response latency. We don't need a `crypto`
 * import for this — we compare lengths first, then XOR the bytes.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
