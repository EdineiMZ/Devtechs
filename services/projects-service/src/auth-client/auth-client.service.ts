import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * HTTP client for the auth-service internal endpoints that
 * projects-service relies on.
 *
 * Today the only call is `GET /auth/permissions/:userId`, used by
 * the PermissionGuard to resolve a user's effective permission set.
 * Same shape as the rh-service auth-client — fail-closed on every
 * failure mode so projects-service never serves requests it
 * couldn't authorize.
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
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`auth-service unreachable at ${url}: ${reason}`);
      throw new InternalServerErrorException('Authorization service is unreachable');
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
