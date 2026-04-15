import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { EnvironmentsService } from '../environments/environments.service';
import { PipelinesGateway } from '../pipelines/pipelines.gateway';
import { RedisService } from '../../redis/redis.service';

export const DEVOPS_JOBS_QUEUE = 'devops-jobs';
export const HEALTH_CHECK_JOB = 'check-environments';

const PROBE_TIMEOUT_MS = 8_000;
const DEGRADED_MS = 1_500;

/**
 * BullMQ processor for the environment health sweep.
 *
 * Every 5 minutes the scheduler enqueues `check-environments`
 * and this worker walks every registered environment URL,
 * pings it with a GET (3s connect + 8s total timeout), and
 * classifies the result:
 *
 *   - HEALTHY   → 2xx/3xx AND round-trip ≤ 1.5s
 *   - DEGRADED  → 2xx/3xx but slow (> 1.5s), OR 4xx
 *   - DOWN      → 5xx, connection refused, timeout, DNS fail
 *
 * The probe result is persisted via `recordProbe()` which both
 * updates the cached row and appends a history sample. If the
 * status CHANGED since the previous sample, we publish an alert
 * on `devops:environment:status` (Redis pub/sub → picked up by
 * notification-service) and emit a `environment:status` event
 * via the /devops WebSocket gateway.
 */
@Processor(DEVOPS_JOBS_QUEUE)
export class HealthCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(HealthCheckProcessor.name);

  constructor(
    private readonly environments: EnvironmentsService,
    private readonly redis: RedisService,
    private readonly gateway: PipelinesGateway,
  ) {
    super();
  }

  async process(job: Job): Promise<{ probed: number; changes: number }> {
    if (job.name !== HEALTH_CHECK_JOB) {
      this.logger.warn(`Ignoring unknown job ${job.name} in ${DEVOPS_JOBS_QUEUE}`);
      return { probed: 0, changes: 0 };
    }

    const targets = await this.environments.listForProbe();
    if (targets.length === 0) {
      return { probed: 0, changes: 0 };
    }

    let changes = 0;
    for (const target of targets) {
      const result = await this.probe(target.url);
      try {
        const { previousStatus, currentStatus } = await this.environments.recordProbe(
          target.id,
          result,
        );
        if (previousStatus !== currentStatus) {
          changes++;
          await this.publishAlert(target.id, previousStatus, currentStatus);
          this.gateway.emitEnvironmentStatus(
            target.id,
            previousStatus,
            currentStatus,
          );
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to record probe for ${target.id} (${target.url}): ${reason}`,
        );
      }
    }

    this.logger.log(
      `Health sweep: probed ${targets.length} environment(s), ${changes} state change(s)`,
    );
    return { probed: targets.length, changes };
  }

  // -------------------------------------------------------------------
  // HTTP probe
  // -------------------------------------------------------------------

  private async probe(url: string): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    httpStatus: number | null;
    responseTimeMs: number | null;
    error: string | null;
  }> {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        redirect: 'manual',
      });
      const elapsed = Date.now() - start;
      const status = res.status;

      if (status >= 500) {
        return {
          status: 'DOWN',
          httpStatus: status,
          responseTimeMs: elapsed,
          error: `HTTP ${status}`,
        };
      }
      if (status >= 400) {
        return {
          status: 'DEGRADED',
          httpStatus: status,
          responseTimeMs: elapsed,
          error: `HTTP ${status}`,
        };
      }
      if (elapsed > DEGRADED_MS) {
        return {
          status: 'DEGRADED',
          httpStatus: status,
          responseTimeMs: elapsed,
          error: `Slow response (${elapsed} ms)`,
        };
      }
      return {
        status: 'HEALTHY',
        httpStatus: status,
        responseTimeMs: elapsed,
        error: null,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return {
        status: 'DOWN',
        httpStatus: null,
        responseTimeMs: Date.now() - start,
        error: reason.slice(0, 500),
      };
    }
  }

  private async publishAlert(
    environmentId: string,
    from: string,
    to: string,
  ): Promise<void> {
    try {
      await this.redis.publish(
        'devops:environment:status',
        JSON.stringify({
          event: 'devops.environment.status-changed',
          occurredAt: new Date().toISOString(),
          environmentId,
          from,
          to,
        }),
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to publish environment status alert: ${reason}`);
    }
  }
}
