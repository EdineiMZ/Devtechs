import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestLike {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Reads the real client IP from `x-real-ip` (set by the Nginx/web proxy)
 * before falling back to `req.ip`. This prevents all requests from appearing
 * to come from the internal Docker gateway (172.16.x.x).
 */
@Injectable()
export class LicenseThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as RequestLike;
    const realIp = r.headers?.['x-real-ip'];
    const resolved = Array.isArray(realIp) ? realIp[0] : realIp;
    return Promise.resolve(resolved ?? r.ip ?? 'unknown');
  }
}
