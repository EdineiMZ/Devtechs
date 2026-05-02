import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  }

  async getPermissions(userId: string): Promise<string[]> {
    const url = `${this.baseUrl}/auth/permissions/${encodeURIComponent(userId)}`;
    let lastErr: string = 'unknown';

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise<void>((r) => setTimeout(r, 400 * attempt));
      }

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
        lastErr = err instanceof Error ? err.message : String(err);
        this.logger.warn(`auth-service unreachable (attempt ${attempt + 1}/3): ${lastErr}`);
        continue;
      }

      if (res.status === 404) throw new NotFoundException(`User ${userId} not found`);
      if (!res.ok) throw new InternalServerErrorException(`auth-service ${res.status}`);
      const body = (await res.json()) as { permissions?: string[] };
      return Array.isArray(body.permissions) ? body.permissions : [];
    }

    this.logger.error(`auth-service unreachable after 3 attempts: ${lastErr}`);
    throw new InternalServerErrorException('Authorization service unreachable');
  }
}
