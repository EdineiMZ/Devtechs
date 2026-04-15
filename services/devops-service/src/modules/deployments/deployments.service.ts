import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<unknown[]> {
    const rows = await this.prisma.deployment.findMany({
      orderBy: { deployedAt: 'desc' },
      take: 100,
      include: {
        pipeline: { select: { id: true, name: true, branch: true, commitSha: true } },
        environment: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      deployedAt: r.deployedAt.toISOString(),
      rolledBackAt: r.rolledBackAt?.toISOString() ?? null,
      pipeline: r.pipeline,
      environment: r.environment,
      user: r.user,
    }));
  }

  async rollback(id: string, userId: string): Promise<unknown> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
      include: {
        environment: { select: { id: true } },
        pipeline: { select: { id: true, projectId: true } },
      },
    });
    if (!deployment) throw new NotFoundException('Deployment not found');
    if (deployment.status === 'ROLLED_BACK') {
      throw new ConflictException('Deployment already rolled back');
    }
    if (deployment.status === 'PENDING' || deployment.status === 'RUNNING') {
      throw new BadRequestException(
        'Cannot rollback a deployment that hasn\'t finished yet',
      );
    }

    // Find the previous SUCCESS deployment on the same environment.
    const previous = await this.prisma.deployment.findFirst({
      where: {
        environmentId: deployment.environment.id,
        status: 'SUCCESS',
        id: { not: deployment.id },
        deployedAt: { lt: deployment.deployedAt },
      },
      orderBy: { deployedAt: 'desc' },
      include: { pipeline: { select: { id: true, commitSha: true } } },
    });
    if (!previous) {
      throw new BadRequestException(
        'No previous successful deployment to roll back to',
      );
    }

    // Mark the current deployment as rolled back and insert a
    // rollback record that points at the previous pipeline.
    const [updated, rollbackRow] = await this.prisma.$transaction([
      this.prisma.deployment.update({
        where: { id },
        data: {
          status: 'ROLLED_BACK',
          rolledBackAt: new Date(),
        },
      }),
      this.prisma.deployment.create({
        data: {
          pipelineId: previous.pipeline.id,
          environmentId: deployment.environment.id,
          status: 'SUCCESS',
          deployedBy: userId,
        },
      }),
    ]);

    this.logger.log(
      `Rolled back deployment ${id} → replay of pipeline ${previous.pipeline.id} (new deployment ${rollbackRow.id})`,
    );

    return {
      rolledBack: { id: updated.id, status: updated.status },
      replay: { id: rollbackRow.id, pipelineId: rollbackRow.pipelineId },
    };
  }
}
