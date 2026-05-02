import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ContainerInspectInfo, ContainerStats } from 'dockerode';

import { DockerClientService } from '../docker/docker-client.service';

export interface ServiceSummary {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'exited' | 'paused' | 'unknown';
  state: string;
  uptime: number | null;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  ports: Array<{ private: number; public: number | null; protocol: string }>;
  image: string;
  labels: Record<string, string>;
}

const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project';
const COMPOSE_SERVICE_LABEL = 'com.docker.compose.service';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly docker: DockerClientService) {}

  private requireDocker(): void {
    if (!this.docker.isAvailable()) {
      throw new ServiceUnavailableException(
        'Docker daemon is not reachable from this service',
      );
    }
  }

  /** List all containers belonging to docker-compose projects. */
  async list(projectFilter?: string): Promise<ServiceSummary[]> {
    this.requireDocker();
    let containers;
    try {
      containers = await this.docker.getClient().listContainers({ all: true });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      // Docker daemon down / pipe missing → degrade to 503 with a
      // helpful message instead of a generic 500.
      if (reason.includes('ENOENT') || reason.includes('ECONNREFUSED')) {
        throw new ServiceUnavailableException(
          'Docker daemon is not running or the socket is not mounted. ' +
            'Start Docker Desktop or mount /var/run/docker.sock.',
        );
      }
      throw new ServiceUnavailableException(`Docker error: ${reason}`);
    }

    const composeContainers = containers.filter((c) => {
      const labels = c.Labels ?? {};
      const project = labels[COMPOSE_PROJECT_LABEL];
      if (!project) return false;
      if (projectFilter && project !== projectFilter) return false;
      return true;
    });

    const summaries = await Promise.all(
      composeContainers.map((c) => this.summarize(c.Id)),
    );
    return summaries.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Build a ServiceSummary for a single container — includes a CPU/mem
   * snapshot via the no-stream stats endpoint (~200ms).
   */
  async summarize(idOrName: string): Promise<ServiceSummary> {
    this.requireDocker();
    const container = this.docker.getClient().getContainer(idOrName);
    let info: ContainerInspectInfo;
    try {
      info = await container.inspect();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new NotFoundException(`Container "${idOrName}" not found: ${reason}`);
    }

    let cpuPercent = 0;
    let memoryUsedMb = 0;
    let memoryTotalMb = 0;
    if (info.State.Running) {
      try {
        const stats = (await container.stats({ stream: false })) as ContainerStats;
        cpuPercent = computeCpuPercent(stats);
        memoryUsedMb = bytesToMb(stats.memory_stats?.usage ?? 0);
        memoryTotalMb = bytesToMb(stats.memory_stats?.limit ?? 0);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`stats failed for ${idOrName}: ${reason}`);
      }
    }

    const labels = info.Config.Labels ?? {};
    const composeService = labels[COMPOSE_SERVICE_LABEL] ?? null;
    const ports = Object.entries(info.NetworkSettings?.Ports ?? {}).map(
      ([key, bindings]) => {
        const [portStr, protocol] = key.split('/');
        const privatePort = Number(portStr);
        const firstBinding = Array.isArray(bindings) ? bindings[0] : undefined;
        const publicPort = firstBinding?.HostPort ? Number(firstBinding.HostPort) : null;
        return { private: privatePort, public: publicPort, protocol: protocol ?? 'tcp' };
      },
    );

    const startedAt = info.State.StartedAt ? new Date(info.State.StartedAt).getTime() : 0;
    const uptime = info.State.Running && startedAt > 0
      ? Math.floor((Date.now() - startedAt) / 1000)
      : null;

    return {
      name: composeService ?? info.Name.replace(/^\//, ''),
      containerName: info.Name.replace(/^\//, ''),
      status: mapStatus(info.State),
      state: info.State.Status,
      uptime,
      cpuPercent: Number(cpuPercent.toFixed(2)),
      memoryUsedMb: Number(memoryUsedMb.toFixed(1)),
      memoryTotalMb: Number(memoryTotalMb.toFixed(1)),
      ports,
      image: info.Config.Image,
      labels,
    };
  }

  /** Find a compose container by service name (label match). */
  async findByServiceName(serviceName: string): Promise<string> {
    this.requireDocker();
    const containers = await this.docker.getClient().listContainers({ all: true });
    const match = containers.find(
      (c) => (c.Labels ?? {})[COMPOSE_SERVICE_LABEL] === serviceName,
    );
    if (!match) {
      throw new NotFoundException(`No container found for compose service "${serviceName}"`);
    }
    return match.Id;
  }

  async start(serviceName: string): Promise<{ ok: true; service: string }> {
    const id = await this.findByServiceName(serviceName);
    await this.docker.getClient().getContainer(id).start();
    this.logger.log(`Started ${serviceName} (${id.slice(0, 12)})`);
    return { ok: true, service: serviceName };
  }

  async stop(serviceName: string): Promise<{ ok: true; service: string }> {
    const id = await this.findByServiceName(serviceName);
    await this.docker.getClient().getContainer(id).stop();
    this.logger.log(`Stopped ${serviceName} (${id.slice(0, 12)})`);
    return { ok: true, service: serviceName };
  }

  async restart(serviceName: string): Promise<{ ok: true; service: string }> {
    const id = await this.findByServiceName(serviceName);
    await this.docker.getClient().getContainer(id).restart();
    this.logger.log(`Restarted ${serviceName} (${id.slice(0, 12)})`);
    return { ok: true, service: serviceName };
  }

  /**
   * Probe the service's own /health endpoint by name. Resolves the
   * port from container metadata so it works without external DNS.
   */
  async health(serviceName: string): Promise<{
    service: string;
    reachable: boolean;
    status?: number;
    body?: unknown;
    error?: string;
  }> {
    const id = await this.findByServiceName(serviceName);
    const summary = await this.summarize(id);
    const port = summary.ports.find((p) => p.public !== null)?.public
      ?? summary.ports[0]?.private;
    if (!port) {
      return { service: serviceName, reachable: false, error: 'No exposed port' };
    }

    const url = `http://${summary.containerName}:${port}/health`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      return { service: serviceName, reachable: res.ok, status: res.status, body };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return { service: serviceName, reachable: false, error: reason };
    }
  }
}

function bytesToMb(bytes: number): number {
  return bytes / (1024 * 1024);
}

function mapStatus(state: ContainerInspectInfo['State']): ServiceSummary['status'] {
  if (state.Running) return 'running';
  if (state.Paused) return 'paused';
  if (state.Status === 'exited') return 'exited';
  if (state.Status === 'created' || state.Status === 'restarting') return 'stopped';
  return 'unknown';
}

/**
 * Compute CPU % from a single stats snapshot the same way `docker stats`
 * does: delta(container_cpu) / delta(system_cpu) * online_cpus * 100.
 */
function computeCpuPercent(stats: ContainerStats): number {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) -
    (stats.precpu_stats?.system_cpu_usage ?? 0);
  const onlineCpus =
    stats.cpu_stats?.online_cpus ??
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ??
    1;
  if (cpuDelta <= 0 || systemDelta <= 0) return 0;
  return (cpuDelta / systemDelta) * onlineCpus * 100;
}
