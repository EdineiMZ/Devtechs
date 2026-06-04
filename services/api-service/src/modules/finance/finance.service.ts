import { HttpException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiKey } from '@szdevs/database';
import type { Request } from 'express';

/**
 * Thin HTTP proxy that forwards requests to the upstream finance-service.
 */
@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'FINANCE_SERVICE_URL',
      'http://finance-service:3003',
    );
  }

  async proxy(
    req: Request & { apiKey: ApiKey },
    upstreamPath: string,
    method: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${upstreamPath}`);

    const rawQuery = (req.query ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(rawQuery)) {
      url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key-Id': req.apiKey.id,
      'X-Api-Key-Name': req.apiKey.name,
      'X-Forwarded-For': this.getClientIp(req),
    };

    const init: RequestInit = { method, headers };
    if (body && method !== 'GET' && method !== 'HEAD') {
      init.body = JSON.stringify(body);
    }

    let resp: Response;
    try {
      resp = await fetch(url.toString(), init);
    } catch (err) {
      this.logger.error(`Upstream request failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Upstream service unavailable');
    }

    const text = await resp.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!resp.ok) {
      throw new HttpException(data ?? `Upstream error ${resp.status}`, resp.status);
    }

    return data;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return (raw ?? '').trim() || 'unknown';
    }
    return req.ip ?? 'unknown';
  }
}
