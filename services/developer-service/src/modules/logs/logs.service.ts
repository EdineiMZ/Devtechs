import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { DockerClientService } from '../docker/docker-client.service';

export interface LogLine {
  stream: 'stdout' | 'stderr';
  timestamp: string;
  message: string;
}

const COMPOSE_SERVICE_LABEL = 'com.docker.compose.service';

@Injectable()
export class LogsService {
  constructor(private readonly docker: DockerClientService) {}

  async getLines(serviceName: string, tail: number): Promise<LogLine[]> {
    if (!this.docker.isAvailable()) {
      throw new ServiceUnavailableException('Docker daemon not reachable');
    }

    const containers = await this.docker.getClient().listContainers({ all: true });
    const match = containers.find((c) => (c.Labels ?? {})[COMPOSE_SERVICE_LABEL] === serviceName);
    if (!match) throw new NotFoundException(`Container for "${serviceName}" not found`);

    const container = this.docker.getClient().getContainer(match.Id);
    const rawBuffer = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail,
    }) as unknown as Buffer;

    return this.demux(rawBuffer);
  }

  /**
   * Docker multiplexed stream format:
   *   [stream_type(1)] [0,0,0(3)] [size(4 BE)] [payload(size)]
   * stream_type: 1=stdout, 2=stderr
   */
  private demux(buf: Buffer): LogLine[] {
    const lines: LogLine[] = [];
    let offset = 0;

    while (offset + 8 <= buf.length) {
      const streamType = buf[offset];
      const size = buf.readUInt32BE(offset + 4);
      offset += 8;

      if (offset + size > buf.length) break;

      const payload = buf.slice(offset, offset + size).toString('utf8');
      offset += size;

      const stream: 'stdout' | 'stderr' = streamType === 2 ? 'stderr' : 'stdout';

      // Each payload may contain multiple newline-separated log lines
      for (const raw of payload.split('\n')) {
        const trimmed = raw.trim();
        if (!trimmed) continue;

        // Docker timestamps format: "2026-05-09T12:34:56.000000000Z <message>"
        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx > 0) {
          const ts = trimmed.slice(0, spaceIdx);
          const msg = trimmed.slice(spaceIdx + 1);
          lines.push({ stream, timestamp: ts, message: msg });
        } else {
          lines.push({ stream, timestamp: new Date().toISOString(), message: trimmed });
        }
      }
    }

    return lines;
  }
}
