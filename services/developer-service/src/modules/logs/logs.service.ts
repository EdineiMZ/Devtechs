import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { DockerClientService } from '../docker/docker-client.service';

export interface ContainerLogOptions {
  tail?: number;
  since?: number;
  timestamps?: boolean;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly docker: DockerClientService) {}

  async getContainerLogs(
    containerId: string,
    options: ContainerLogOptions = {},
  ): Promise<string> {
    if (!this.docker.isAvailable()) {
      throw new ServiceUnavailableException('Docker is not available');
    }

    const { tail = 100, since, timestamps = false } = options;

    try {
      const container = this.docker.getClient().getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        since,
        timestamps,
      });
      return stream.toString('utf-8');
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to get logs for container ${containerId}: ${reason}`);
      throw err;
    }
  }

  async listContainers(): Promise<Array<{ id: string; name: string; status: string }>> {
    if (!this.docker.isAvailable()) {
      throw new ServiceUnavailableException('Docker is not available');
    }

    const containers = await this.docker.getClient().listContainers({ all: true });
    return containers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: (c.Names[0] ?? '').replace(/^\//, ''),
      status: c.Status,
    }));
  }
}
