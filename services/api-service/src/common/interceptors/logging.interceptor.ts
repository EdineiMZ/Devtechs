import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Logs every HTTP request (method, url, status, duration, caller IP).
 * Keeps the format compact so it is easy to grep in docker logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { method, originalUrl, ip } = req;
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} +${ms}ms - ${ip} "${userAgent}"`,
          );
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          this.logger.warn(
            `${method} ${originalUrl} FAILED +${ms}ms - ${ip} - ${err.message}`,
          );
        },
      }),
    );
  }
}
