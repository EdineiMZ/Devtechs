import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP client for the auth-service internal endpoints that rh-service
 * relies on.
 *
 * The only route it calls today is `GET /auth/permissions/:userId`,
 * which the `PermissionGuard` consumes to resolve a user's effective
 * permission set. Other internal calls (e.g. fetching a user profile)
 * would live on this same service so the base URL + shared-secret
 * handling stays in one place.
 *
 * Env:
 *   - `AUTH_SERVICE_URL` — internal URL of auth-service, e.g.
 *     `http://auth-service:3001`. Docker compose sets this via the
 *     service name; local dev can override with localhost.
 *   - `AUTH_INTERNAL_SECRET` — shared secret sent as
 *     `X-Internal-Secret`. Must match the same-named env var on
 *     auth-service. Fail-closed on both sides if unset.
 */
@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly baseUrl: string;
  private readonly internalSecret: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>('AUTH_SERVICE_URL') ?? 'http://auth-service:3001'
    ).replace(/\/+$/, '');
    this.internalSecret = config.get<string>('AUTH_INTERNAL_SECRET') ?? '';
    if (!this.internalSecret) {
      this.logger.warn(
        'AUTH_INTERNAL_SECRET is not configured — permission lookups will fail at runtime',
      );
    }
  }

  /**
   * Resolve a user's effective permission set from auth-service.
   * Returns an array of permission keys (e.g. `['rh:employees:view']`).
   *
   * Network failures throw `InternalServerErrorException`; a 404 for
   * an unknown user throws `NotFoundException`. Callers (the
   * PermissionGuard) translate these into 500/401 responses.
   */
  async getPermissions(userId: string): Promise<string[]> {
    const url = `${this.baseUrl}/auth/permissions/${encodeURIComponent(userId)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        // Keep the call fast — a slow auth-service shouldn't
        // cascade into a slow rh-service. 5s is generous enough
        // for docker-network hops and leaves headroom.
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`auth-service unreachable at ${url}: ${reason}`);
      throw new InternalServerErrorException(
        'Authorization service is unreachable',
      );
    }

    if (res.status === 404) {
      throw new NotFoundException(`User ${userId} not found in auth-service`);
    }

    if (!res.ok) {
      this.logger.error(
        `auth-service returned ${res.status} for permission lookup of ${userId}`,
      );
      throw new InternalServerErrorException(
        `Authorization service returned ${res.status}`,
      );
    }

    const body = (await res.json()) as { userId?: string; permissions?: string[] };
    return Array.isArray(body.permissions) ? body.permissions : [];
  }
}
