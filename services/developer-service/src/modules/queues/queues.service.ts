import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis, { Redis as RedisType } from 'ioredis';

interface QueueSummary {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
}

interface JobSummary {
  id: string;
  name: string;
  status: string;
  attemptsMade: number;
  failedReason: string | null;
  data: unknown;
  timestamp: number;
  finishedOn: number | null;
  processedOn: number | null;
}

const KNOWN_QUEUE_NAMES = [
  'finance-jobs',
  'notifications',
  'support-jobs',
  'devops-health',
  'license-tokens',
];

@Injectable()
export class QueuesService implements OnModuleDestroy {
  private readonly logger = new Logger(QueuesService.name);
  private readonly queues = new Map<string, Queue>();
  private connection!: RedisType;
  private readonly devMode: boolean;

  constructor(private readonly config: ConfigService) {
    this.devMode = (process.env.NODE_ENV ?? 'development') !== 'production';
    this.initConnection();
  }

  private initConnection(): void {
    const url = this.config.get<string>('REDIS_URL');
    const opts = {
      maxRetriesPerRequest: this.devMode ? 1 : null,
      enableOfflineQueue: false,
      lazyConnect: this.devMode,
      connectTimeout: this.devMode ? 2000 : 10_000,
      retryStrategy: this.devMode ? (): null => null : undefined,
    } as const;
    this.connection = url
      ? new IORedis(url, opts)
      : new IORedis({
          host: this.config.get<string>('REDIS_HOST', 'redis'),
          port: Number(this.config.get<string>('REDIS_PORT', '6379')),
          ...opts,
        });
    this.connection.on('error', (err) => {
      if (this.devMode) {
        this.logger.warn(`Queues Redis unavailable: ${err.message}`);
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    for (const queue of this.queues.values()) {
      try {
        await queue.close();
      } catch {}
    }
    try {
      await this.connection.quit();
    } catch {}
  }

  private getQueue(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.connection });
      this.queues.set(name, queue);
    }
    return queue;
  }

  /** Discover queues — known list + any extras present in Redis. */
  async list(): Promise<QueueSummary[]> {
    const names = await this.discoverNames();
    const summaries: QueueSummary[] = [];
    for (const name of names) {
      try {
        summaries.push(await this.summarize(name));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to summarize queue ${name}: ${reason}`);
      }
    }
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async discoverNames(): Promise<string[]> {
    const names = new Set<string>(KNOWN_QUEUE_NAMES);
    try {
      // BullMQ 5.x stores meta keys at "bull:<queueName>:meta".
      const keys = await this.scanKeys('bull:*:meta');
      for (const k of keys) {
        const m = /^bull:(.+):meta$/.exec(k);
        if (m && m[1]) names.add(m[1]);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Queue discovery failed: ${reason}`);
    }
    return [...names];
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    if (this.devMode && this.connection.status !== 'ready') {
      try {
        if (this.connection.status === 'wait') await this.connection.connect();
      } catch {
        return [];
      }
    }
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.connection.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = next;
      found.push(...keys);
    } while (cursor !== '0');
    return found;
  }

  async summarize(name: string): Promise<QueueSummary> {
    if (this.devMode && this.connection.status !== 'ready') {
      try {
        if (this.connection.status === 'wait') await this.connection.connect();
      } catch {
        throw new ServiceUnavailableException('Redis unavailable');
      }
    }
    const queue = this.getQueue(name);
    try {
      const counts = await queue.getJobCounts(
        'active',
        'waiting',
        'delayed',
        'failed',
        'completed',
      );
      const paused = await queue.isPaused();
      return {
        name,
        active: Number(counts.active ?? 0),
        waiting: Number(counts.waiting ?? 0),
        delayed: Number(counts.delayed ?? 0),
        failed: Number(counts.failed ?? 0),
        completed: Number(counts.completed ?? 0),
        paused,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`Queue ${name} unreachable: ${reason}`);
    }
  }

  async listJobs(
    name: string,
    status: 'active' | 'waiting' | 'delayed' | 'failed' | 'completed' = 'failed',
    limit = 50,
  ): Promise<JobSummary[]> {
    const queue = this.getQueue(name);
    let jobs;
    try {
      jobs = await queue.getJobs([status], 0, limit - 1, false);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ServiceUnavailableException(`Cannot list jobs: ${reason}`);
    }

    return jobs.map((job) => ({
      id: String(job.id),
      name: job.name,
      status,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? null,
      data: job.data,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn ?? null,
      processedOn: job.processedOn ?? null,
    }));
  }

  async retryJob(name: string, jobId: string): Promise<{ ok: true }> {
    const queue = this.getQueue(name);
    const job = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found in ${name}`);
    await job.retry();
    this.logger.log(`Retried job ${jobId} on queue ${name}`);
    return { ok: true };
  }

  async cleanFailed(name: string): Promise<{ removed: number }> {
    const queue = this.getQueue(name);
    const removed = await queue.clean(0, 1000, 'failed');
    this.logger.log(`Cleaned ${removed.length} failed jobs from ${name}`);
    return { removed: removed.length };
  }
}
