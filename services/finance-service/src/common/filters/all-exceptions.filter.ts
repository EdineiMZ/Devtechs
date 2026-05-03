import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
}

/**
 * Global exception normalizer for finance-service. Same body shape
 * as auth-service / projects-service / rh-service so frontends can
 * branch on `error`/`statusCode` regardless of which backend answered.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as { message?: string | string[]; error?: string };
        message = body.message ?? exception.message;
        errorName = body.error ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorName = exception.name;
      this.logger.error(`Unhandled ${errorName}: ${message}`, exception.stack);
    } else if (typeof exception === 'object' && exception !== null) {
      const plain = exception as Record<string, unknown>;
      const rawMsg = plain.message;
      message = typeof rawMsg === 'string' && rawMsg ? rawMsg : 'Internal server error';
      const rawStatus = plain.status ?? plain.statusCode;
      if (typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600) {
        status = rawStatus;
      }
      this.logger.error(`Unhandled plain exception: ${JSON.stringify(exception)}`);
    } else {
      this.logger.error(`Unknown exception type: ${JSON.stringify(exception)}`);
    }

    const body: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error: errorName,
    };

    response.status(status).json(body);
  }
}
