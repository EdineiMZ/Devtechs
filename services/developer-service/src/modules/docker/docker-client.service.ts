import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Docker from 'dockerode';

/**
 * Docker client wrapper.
 *
 * The Docker daemon's UNIX socket (`/var/run/docker.sock` on Linux,
 * `//./pipe/docker_engine` on Windows) is mounted into this container
 * so dockerode can talk directly to the host engine. In docker-compose:
 *
 *   developer-service:
 *     volumes:
 *       - /var/run/docker.sock:/var/run/docker.sock
 *
 * On the host machine the socket is owned by the `docker` group; the
 * container runs as a user inside that group so reads/writes succeed
 * without root. Dockerode auto-detects the platform and uses the right
 * default path; explicit overrides come from `DOCKER_SOCKET_PATH`.
 */
@Injectable()
export class DockerClientService implements OnModuleInit {
  private readonly logger = new Logger(DockerClientService.name);
  private client!: Docker;
  private available = false;

  onModuleInit(): void {
    const socketPath = process.env.DOCKER_SOCKET_PATH;
    try {
      if (socketPath) {
        this.client = new Docker({ socketPath });
      } else if (process.platform === 'win32') {
        this.client = new Docker({ socketPath: '//./pipe/docker_engine' });
      } else {
        this.client = new Docker({ socketPath: '/var/run/docker.sock' });
      }
      this.available = true;
      this.logger.log(`Docker client initialized (socket=${socketPath ?? 'default'})`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Docker client init failed: ${reason}. Service ops disabled.`);
      this.available = false;
    }
  }

  getClient(): Docker {
    return this.client;
  }

  isAvailable(): boolean {
    return this.available;
  }

  /** Probe the Docker daemon to confirm reachability. */
  async ping(): Promise<boolean> {
    if (!this.available) return false;
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}
