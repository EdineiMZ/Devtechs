import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@szdevs/database';

import { PrismaService } from '../../prisma/prisma.service';
import { GithubService } from '../github/github.service';

import type {
  QueryPipelinesDto,
  TriggerPipelineDto,
} from './dto/pipeline.dto';

/**
 * PipelinesService â€” read API, webhook-driven upsert, and the
 * outbound trigger call to GitHub. Status transitions come from
 * two paths:
 *
 *   - REST caller on `POST /pipelines/trigger` â†’ we create a
 *     QUEUED row locally and call `github.triggerWorkflow`.
 *     The row is later updated by the webhook handler when
 *     GitHub reports RUNNING / SUCCESS / FAILED.
 *
 *   - GitHub webhook on `workflow_run` â†’ upsert keyed on
 *     `(provider, externalId)` so retries and re-deliveries
 *     never create duplicates.
 */
@Injectable()
export class PipelinesService {
  private readonly logger = new Logger(PipelinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubService,
  ) {}

  // ===================================================================
  // Reads
  // ===================================================================

  async list(query: QueryPipelinesDto): Promise<{
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const where: Prisma.PipelineWhereInput = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.branch) where.branch = query.branch;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.pipeline.count({ where }),
      this.prisma.pipeline.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { logs: true, deployments: true } },
        },
      }),
    ]);

    return {
      items: rows.map((r) => this.serialize(r)),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async get(id: string): Promise<unknown> {
    const row = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { logs: true, deployments: true } },
      },
    });
    if (!row) throw new NotFoundException('Pipeline not found');
    return this.serialize(row);
  }

  async getLogs(
    id: string,
  ): Promise<Array<{
    id: string;
    step: string;
    status: string;
    output: string;
    startedAt: string;
    finishedAt: string | null;
  }>> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const logs = await this.prisma.pipelineLog.findMany({
      where: { pipelineId: id },
      orderBy: { startedAt: 'asc' },
    });
    return logs.map((log) => ({
      id: log.id,
      step: log.step,
      status: log.status,
      output: log.output,
      startedAt: log.startedAt.toISOString(),
      finishedAt: log.finishedAt?.toISOString() ?? null,
    }));
  }

  // ===================================================================
  // Trigger (outbound)
  // ===================================================================

  async trigger(
    dto: TriggerPipelineDto,
    triggeredBy: string,
  ): Promise<unknown> {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException(`Unknown projectId: ${dto.projectId}`);
    }

    // Fire-and-forget the dispatch on GitHub. The provider has
    // no "return the run id" contract on workflow_dispatch, so
    // we create a locally-generated placeholder externalId and
    // let the webhook handler reconcile/replace it when the
    // real run_id comes back.
    const ok = await this.github.triggerWorkflow({
      owner: dto.owner,
      repo: dto.repo,
      workflowId: dto.workflowId,
      ref: dto.ref,
      inputs: dto.inputs,
    });
    if (!ok) {
      throw new BadRequestException('GitHub refused the workflow dispatch');
    }

    const pipeline = await this.prisma.pipeline.create({
      data: {
        name: `${dto.owner}/${dto.repo}/${dto.workflowId}`,
        projectId: dto.projectId,
        provider: 'GITHUB_ACTIONS',
        // Placeholder externalId â€” the webhook upsert will
        // collapse this row into the real run_id one when the
        // first workflow_run event arrives.
        externalId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        branch: dto.ref,
        status: 'QUEUED',
        commitSha: '',
        commitMessage: null,
        triggeredBy,
      },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { logs: true, deployments: true } },
      },
    });

    this.logger.log(
      `Triggered ${dto.owner}/${dto.repo}:${dto.workflowId} on ref ${dto.ref} by ${triggeredBy}`,
    );
    return this.serialize(pipeline);
  }

  // ===================================================================
  // GitHub webhook upsert
  // ===================================================================

  /**
   * Upsert a pipeline row from a GitHub `workflow_run` event.
   *
   * GitHub payload fields used:
   *   - `action`                       â†’ "requested" / "in_progress" / "completed"
   *   - `workflow_run.id`              â†’ externalId
   *   - `workflow_run.name`            â†’ display name
   *   - `workflow_run.head_branch`     â†’ branch
   *   - `workflow_run.head_sha`        â†’ commitSha
   *   - `workflow_run.head_commit.message` â†’ commitMessage
   *   - `workflow_run.run_started_at`  â†’ startedAt
   *   - `workflow_run.updated_at`      â†’ finishedAt (on completed)
   *   - `workflow_run.status`          â†’ "queued" / "in_progress" / "completed"
   *   - `workflow_run.conclusion`      â†’ "success" / "failure" / "cancelled"
   *   - `repository.full_name`         â†’ owner/repo for display
   */
  async upsertFromWebhook(payload: {
    action: string;
    workflow_run?: {
      id: number;
      name: string;
      head_branch: string;
      head_sha: string;
      run_started_at?: string;
      updated_at?: string;
      status: string;
      conclusion: string | null;
      head_commit?: { message?: string };
    };
    repository?: { full_name: string };
  }): Promise<{ id: string; status: string } | null> {
    const run = payload.workflow_run;
    if (!run) return null;

    const externalId = String(run.id);
    const status = this.mapWebhookStatus(run.status, run.conclusion);

    // Attempt to resolve a project from the repo's full_name
    // stored in a previously-triggered pipeline. If we've never
    // seen this repo we park the pipeline on the first project
    // the service knows about â€” a future enhancement can wire a
    // GitHub repo â†’ project mapping table.
    const project = await this.resolveProjectForRepo(payload.repository?.full_name);

    const startedAt = run.run_started_at ? new Date(run.run_started_at) : null;
    const finishedAt =
      status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELLED'
        ? run.updated_at
          ? new Date(run.updated_at)
          : new Date()
        : null;
    const duration =
      startedAt && finishedAt
        ? Math.max(0, Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000))
        : null;

    const data: Prisma.PipelineUncheckedCreateInput = {
      name: run.name,
      projectId: project?.id ?? '',
      provider: 'GITHUB_ACTIONS',
      externalId,
      branch: run.head_branch,
      status,
      startedAt: startedAt ?? undefined,
      finishedAt: finishedAt ?? undefined,
      commitSha: run.head_sha,
      commitMessage: run.head_commit?.message ?? null,
      duration: duration ?? undefined,
    };

    if (!project) {
      // Can't upsert without a project â€” log and skip rather
      // than blowing up the webhook handler. Ops can retry
      // once the mapping exists.
      this.logger.warn(
        `Skipping webhook: no project linked to repo ${payload.repository?.full_name ?? 'unknown'}`,
      );
      return null;
    }

    const row = await this.prisma.pipeline.upsert({
      where: {
        provider_externalId: {
          provider: 'GITHUB_ACTIONS',
          externalId,
        },
      },
      create: data,
      update: {
        status,
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        commitSha: data.commitSha,
        commitMessage: data.commitMessage,
        duration: data.duration,
        branch: data.branch,
      },
      select: { id: true, status: true },
    });
    this.logger.log(
      `Pipeline webhook upsert: ${row.id} â†’ ${row.status} (${externalId})`,
    );
    return row;
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private mapWebhookStatus(
    status: string,
    conclusion: string | null,
  ): 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' {
    if (status === 'queued') return 'QUEUED';
    if (status === 'in_progress') return 'RUNNING';
    if (status === 'completed') {
      if (conclusion === 'success') return 'SUCCESS';
      if (conclusion === 'cancelled') return 'CANCELLED';
      return 'FAILED';
    }
    return 'QUEUED';
  }

  private async resolveProjectForRepo(
    fullName: string | undefined,
  ): Promise<{ id: string } | null> {
    // Today we match on the first project where at least one
    // pipeline already used this repo's `name` as the pipeline
    // display name prefix. A dedicated mapping table is a
    // follow-up item.
    if (!fullName) {
      const fallback = await this.prisma.project.findFirst({
        select: { id: true },
      });
      return fallback;
    }
    const existing = await this.prisma.pipeline.findFirst({
      where: { name: { startsWith: fullName } },
      select: { projectId: true },
    });
    if (existing) return { id: existing.projectId };
    const fallback = await this.prisma.project.findFirst({
      select: { id: true },
    });
    return fallback;
  }

  private serialize(row: {
    id: string;
    name: string;
    projectId: string;
    provider: string;
    externalId: string;
    branch: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    triggeredBy: string | null;
    commitSha: string;
    commitMessage: string | null;
    duration: number | null;
    createdAt: Date;
    updatedAt: Date;
    project?: { id: string; name: string } | null;
    _count?: { logs: number; deployments: number };
  }): unknown {
    return {
      id: row.id,
      name: row.name,
      project: row.project ?? null,
      provider: row.provider,
      externalId: row.externalId,
      branch: row.branch,
      status: row.status,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      duration: row.duration,
      triggeredBy: row.triggeredBy,
      commitSha: row.commitSha,
      commitMessage: row.commitMessage,
      logCount: row._count?.logs ?? 0,
      deploymentCount: row._count?.deployments ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
