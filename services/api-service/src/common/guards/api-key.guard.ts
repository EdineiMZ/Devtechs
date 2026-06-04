import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ApiKey, IpBindingMode } from '@szdevs/database';
import type { Request, Response } from 'express';

import { verifySecret } from '../crypto/key-gen';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

interface RateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
}

const BLOCKED_IP_ALERT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BLOCKED_IP_ALERT_THRESHOLD = 10;

/**
 * Core API key authentication guard.
 *
 * Pipeline:
 *  1. Extract Bearer token from Authorization header
 *  2. Split on '_' to recover prefix (szd_live_XXXXXXXX) and secret (32 chars)
 *  3. Look up ApiKey by keyPrefix in DB
 *  4. bcrypt.compare secret against keyHash → 401 if fails
 *  5. Check status (ACTIVE) → 403 with reason
 *  6. Check expiresAt → 403, mark EXPIRED
 *  7. Rate limit sliding window per minute/hour/day via Redis INCR
 *  8. IP binding (DISABLED / AUTO / MANUAL)
 *  9. Attach apiKey to request.apiKey
 * 10. Fire-and-forget audit log + stats update
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing API key');
    }

    // Format: szd_live_{8chars}_{32chars}
    // Split into prefix = "szd_live_XXXXXXXX" and secret = 32-char tail.
    const parts = token.split('_');
    // parts[0]="szd", parts[1]="live", parts[2]=8-char id, parts[3]=32-char secret
    if (parts.length < 4 || parts[0] !== 'szd' || parts[1] !== 'live') {
      throw new UnauthorizedException('Invalid API key format');
    }
    const prefix = `szd_live_${parts[2] ?? ''}`;
    const secret = parts[3] ?? '';

    // 3. DB lookup by prefix
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyPrefix: prefix },
    });
    if (!apiKey) {
      throw new UnauthorizedException('API key not found');
    }

    // 4. Verify secret via bcrypt
    const valid = await verifySecret(secret, apiKey.keyHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // 5. Check status
    if (apiKey.status === 'REVOKED') {
      throw new ForbiddenException(
        apiKey.revokeReason
          ? `API key revoked: ${apiKey.revokeReason}`
          : 'API key has been revoked',
      );
    }
    if (apiKey.status === 'SUSPENDED') {
      throw new ForbiddenException('API key is suspended');
    }

    // 6. Check expiry
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      setImmediate(() => {
        this.prisma.apiKey
          .update({ where: { id: apiKey.id }, data: { status: 'EXPIRED' } })
          .catch(() => {});
      });
      throw new ForbiddenException('API key has expired');
    }

    if (apiKey.status === 'EXPIRED') {
      throw new ForbiddenException('API key has expired');
    }

    // 7. Rate limiting — sliding window via Redis INCR + EXPIRE
    const clientIp = this.getClientIp(req);
    await this.checkRateLimit(apiKey, res);

    // 8. IP binding
    await this.checkIpBinding(apiKey, clientIp);

    // 9. Attach apiKey to request
    (req as Request & { apiKey: ApiKey }).apiKey = apiKey;

    // 10. Fire-and-forget: audit log + stats update
    const endpoint = `${req.method} ${req.path}`;
    setImmediate(() => {
      Promise.all([
        this.prisma.apiKeyAuditLog
          .create({
            data: {
              apiKeyId: apiKey.id,
              event: 'REQUEST_OK',
              ip: clientIp,
              endpoint,
              statusCode: 200,
            },
          })
          .catch(() => {}),
        this.prisma.apiKey
          .update({
            where: { id: apiKey.id },
            data: {
              lastUsedAt: new Date(),
              lastUsedIp: clientIp,
              totalRequests: { increment: 1 },
            },
          })
          .catch(() => {}),
      ]).catch(() => {});
    });

    return true;
  }

  private extractBearer(req: Request): string | null {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7).trim();
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return (raw ?? '').trim() || 'unknown';
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  private async checkRateLimit(apiKey: ApiKey, res: Response): Promise<void> {
    const limits = apiKey.rateLimit as unknown as RateLimitConfig;
    const now = Date.now();

    const minuteWindow = Math.floor(now / 60_000);
    const hourWindow = Math.floor(now / 3_600_000);
    const dayWindow = Math.floor(now / 86_400_000);

    const minuteKey = `ratelimit:apikey:${apiKey.id}:minute:${minuteWindow}`;
    const hourKey = `ratelimit:apikey:${apiKey.id}:hour:${hourWindow}`;
    const dayKey = `ratelimit:apikey:${apiKey.id}:day:${dayWindow}`;

    // Increment all three windows concurrently
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      this.incrWithExpire(minuteKey, 65),
      this.incrWithExpire(hourKey, 3660),
      this.incrWithExpire(dayKey, 86_460),
    ]);

    // Check limits in order of granularity: minute, hour, day
    if (minuteCount > limits.perMinute) {
      const resetAt = (minuteWindow + 1) * 60_000;
      res.setHeader('X-RateLimit-Limit', limits.perMinute);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
      throw new HttpException('Rate limit exceeded (per minute)', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (hourCount > limits.perHour) {
      const resetAt = (hourWindow + 1) * 3_600_000;
      res.setHeader('X-RateLimit-Limit', limits.perHour);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
      throw new HttpException('Rate limit exceeded (per hour)', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (dayCount > limits.perDay) {
      const resetAt = (dayWindow + 1) * 86_400_000;
      res.setHeader('X-RateLimit-Limit', limits.perDay);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
      throw new HttpException('Rate limit exceeded (per day)', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Set informational headers for the minute window (most granular)
    res.setHeader('X-RateLimit-Limit', limits.perMinute);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.perMinute - minuteCount));
    res.setHeader('X-RateLimit-Reset', Math.ceil(((minuteWindow + 1) * 60_000) / 1000));
  }

  /**
   * Increment a Redis counter and set TTL if it's a new key.
   * Returns the new count. Falls back to 0 if Redis is unavailable
   * (allows the request through in degraded mode).
   */
  private async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttlSeconds);
    }
    return count;
  }

  private async checkIpBinding(apiKey: ApiKey, clientIp: string): Promise<void> {
    const mode = apiKey.ipBinding as IpBindingMode;

    if (mode === 'DISABLED') return;

    if (mode === 'AUTO') {
      if (apiKey.boundIps.length === 0) {
        // First use: learn this IP
        setImmediate(() => {
          this.prisma.apiKey
            .update({
              where: { id: apiKey.id },
              data: { boundIps: [clientIp] },
            })
            .catch(() => {});
        });
        return;
      }
      if (!apiKey.boundIps.includes(clientIp)) {
        await this.handleBlockedIp(apiKey, clientIp);
        throw new ForbiddenException(`IP address not allowed: ${clientIp}`);
      }
      return;
    }

    // MANUAL mode
    if (!apiKey.boundIps.includes(clientIp)) {
      await this.handleBlockedIp(apiKey, clientIp);
      throw new ForbiddenException(`IP address not allowed: ${clientIp}`);
    }
  }

  private async handleBlockedIp(apiKey: ApiKey, clientIp: string): Promise<void> {
    // Audit log
    setImmediate(() => {
      this.prisma.apiKeyAuditLog
        .create({
          data: {
            apiKeyId: apiKey.id,
            event: 'BLOCKED_IP',
            ip: clientIp,
            meta: { boundIps: apiKey.boundIps, mode: apiKey.ipBinding },
          },
        })
        .catch(() => {});
    });

    // Check if we should alert admin (10+ BLOCKED_IP in last 5 minutes)
    void this.maybeAlertAdmin(apiKey, clientIp);
  }

  private async maybeAlertAdmin(apiKey: ApiKey, clientIp: string): Promise<void> {
    try {
      const alertKey = `alert:blockedip:${apiKey.id}`;
      const count = await this.redis.incr(alertKey);
      if (count === 1) {
        await this.redis.expire(alertKey, Math.ceil(BLOCKED_IP_ALERT_WINDOW_MS / 1000));
      }
      if (count >= BLOCKED_IP_ALERT_THRESHOLD) {
        await this.redis.publish('api:alerts', {
          type: 'BLOCKED_IP_THRESHOLD',
          apiKeyId: apiKey.id,
          apiKeyName: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          blockedIp: clientIp,
          count,
          windowMinutes: BLOCKED_IP_ALERT_WINDOW_MS / 60_000,
          timestamp: new Date().toISOString(),
        });
        // Reset counter after alert to avoid flooding
        await this.redis.del(alertKey);
      }
    } catch {
      // Alert failure must never block the main request flow
    }
  }
}
