import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { exec as execCb, spawn } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../redis/redis.service';
import { DockerClientService } from '../docker/docker-client.service';
import { MonitorEventBus } from './monitor-events.service';

const REDIS_AUTO_RESTART_KEY = 'monitor:auto-restart';

const exec = promisify(execCb);

export interface ServiceDefinition {
  name: string;
  displayName: string;
  port: number;
}

export interface ServiceStatus {
  name: string;
  displayName: string;
  port: number;
  online: boolean;
  responseMs: number | null;
  lastChecked: string;
  upSince: string | null;
  downSince: string | null;
  consecutiveFailures: number;
  autoRestart: boolean;
}

// Ports here are the INTERNAL container ports each NestJS app binds to.
// In docker-compose the same number is exposed on the host as 4001..4010
// (used by nginx + browser), but the developer-service itself probes on
// the docker network where every peer is reachable at <service-name>:<3xxx>.
// The legacy values (4001..4010) caused the probe at 127.0.0.1:<port> to
// always fail inside the container, which combined with auto-restart=true
// produced a kill-loop where every healthy service was restarted every 20s.
const SERVICES: ServiceDefinition[] = [
  { name: 'auth-service',         displayName: 'Auth',         port: 3001 },
  { name: 'rh-service',           displayName: 'RH',           port: 3002 },
  { name: 'finance-service',      displayName: 'Finance',      port: 3003 },
  { name: 'projects-service',     displayName: 'Projects',     port: 3004 },
  { name: 'devops-service',       displayName: 'DevOps',       port: 3005 },
  { name: 'support-service',      displayName: 'Support',      port: 3006 },
  { name: 'payments-service',     displayName: 'Payments',     port: 3007 },
  { name: 'notification-service', displayName: 'Notification', port: 3008 },
  { name: 'license-service',      displayName: 'License',      port: 3009 },
  { name: 'developer-service',    displayName: 'Developer',    port: 3010 },
];

const CHECK_INTERVAL_MS   = 10_000;
const HEALTH_TIMEOUT_MS   = 3_000;
const AUTO_RESTART_THRESHOLD = 2;

@Injectable()
export class MonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitorService.name);
  private readonly state = new Map<string, ServiceStatus>();
  private readonly autoRestart = new Map<string, boolean>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  /**
   * Optional override for probe hostname. Default is to use each service's
   * own name as the hostname (resolves via docker-compose's network DNS).
   * Set MONITOR_HOST=127.0.0.1 only when running developer-service on the
   * host with the other services bound to 127.0.0.1 (rare local setup).
   */
  private readonly hostOverride: string | null;

  /** Absolute path to the `services/` directory of the monorepo. */
  private readonly servicesDir: string;

  constructor(
    private readonly events: MonitorEventBus,
    private readonly docker: DockerClientService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.hostOverride = config.get<string>('MONITOR_HOST') ?? null;

    // developer-service runs with cwd = <monorepo>/services/developer-service
    // so one level up is <monorepo>/services
    this.servicesDir =
      config.get<string>('SERVICES_DIR') ?? path.resolve(process.cwd(), '..');

    for (const svc of SERVICES) {
      this.state.set(svc.name, {
        name: svc.name,
        displayName: svc.displayName,
        port: svc.port,
        online: false,
        responseMs: null,
        lastChecked: new Date().toISOString(),
        upSince: null,
        downSince: null,
        consecutiveFailures: 0,
        autoRestart: false,
      });
      this.autoRestart.set(svc.name, false);
    }
  }

  async onModuleInit(): Promise<void> {
    // Load persisted auto-restart flags from Redis before starting the sweep
    // so the first health check already knows which services should auto-restart.
    try {
      const stored = await this.redis.hgetall(REDIS_AUTO_RESTART_KEY);
      for (const [name, value] of Object.entries(stored)) {
        if (this.autoRestart.has(name)) {
          const enabled = value === '1';
          this.autoRestart.set(name, enabled);
          const current = this.state.get(name);
          if (current) {
            this.state.set(name, { ...current, autoRestart: enabled });
          }
        }
      }
      this.logger.log(`Loaded auto-restart preferences from Redis (${Object.keys(stored).length} entries)`);
    } catch (err) {
      this.logger.warn(`Could not load auto-restart preferences from Redis: ${String(err)}`);
    }

    void this.sweep();
    this.intervalHandle = setInterval(() => void this.sweep(), CHECK_INTERVAL_MS);
    this.logger.log(`Monitoring ${SERVICES.length} services every ${CHECK_INTERVAL_MS / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  // ─── Public API ──────────────────────────────────────────────────────

  listStatus(): ServiceStatus[] {
    return Array.from(this.state.values());
  }

  getStatus(name: string): ServiceStatus | undefined {
    return this.state.get(name);
  }

  async setAutoRestart(name: string, enabled: boolean): Promise<ServiceStatus> {
    const current = this.state.get(name);
    if (!current) throw new NotFoundException(`Serviço não encontrado: ${name}`);
    this.autoRestart.set(name, enabled);
    const updated: ServiceStatus = { ...current, autoRestart: enabled };
    this.state.set(name, updated);
    this.events.update$.next(updated);
    this.logger.log(`Auto-restart ${enabled ? 'ON' : 'OFF'} for ${name}`);

    // Persist to Redis so the preference survives service restarts
    await this.redis.hset(REDIS_AUTO_RESTART_KEY, name, enabled ? '1' : '0');

    return updated;
  }

  async restartService(name: string): Promise<{ ok: boolean; message: string }> {
    return this.control(name, 'restart');
  }

  async stopService(name: string): Promise<{ ok: boolean; message: string }> {
    return this.control(name, 'stop');
  }

  async startService(name: string): Promise<{ ok: boolean; message: string }> {
    return this.control(name, 'start');
  }

  // ─── Sweep / probe ───────────────────────────────────────────────────

  private async sweep(): Promise<void> {
    await Promise.allSettled(SERVICES.map((s) => this.checkOne(s)));
  }

  private async checkOne(svc: ServiceDefinition): Promise<void> {
    const prev = this.state.get(svc.name)!;
    const { online, responseMs } = await this.probe(svc);
    const now = new Date().toISOString();
    const wasOnline = prev.online;
    const failures = online ? 0 : prev.consecutiveFailures + 1;

    const updated: ServiceStatus = {
      ...prev,
      online,
      responseMs,
      lastChecked: now,
      upSince:   online && !wasOnline ? now : (online ? prev.upSince : null),
      downSince: !online && wasOnline ? now : (!online ? (prev.downSince ?? now) : null),
      consecutiveFailures: failures,
      autoRestart: this.autoRestart.get(svc.name) ?? false,
    };

    this.state.set(svc.name, updated);
    this.events.update$.next(updated);

    if (online !== wasOnline) {
      this.logger.log(`${svc.name} → ${online ? 'ONLINE' : 'OFFLINE'}`);
      this.events.statusChange$.next(updated);
    }

    // Auto-restart, but ONLY if the service was previously seen online —
    // i.e. this represents a real "went down". Without this guard, a probe
    // misconfig (wrong host/port/DNS) makes every service look down from
    // the very first sweep and we restart healthy peers in a tight loop;
    // happened in production when the SERVICES table had host ports
    // (4xxx) instead of internal ports (3xxx).
    if (
      !online &&
      failures >= AUTO_RESTART_THRESHOLD &&
      this.autoRestart.get(svc.name) &&
      prev.upSince !== null
    ) {
      this.logger.warn(`Auto-restart ${svc.name} after ${failures} failures`);
      try {
        await this.control(svc.name, 'restart');
        this.events.autoRestarted$.next({
          service: svc.name,
          displayName: svc.displayName,
          ts: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.error(`Auto-restart failed for ${svc.name}: ${String(err)}`);
      }
    }
  }

  private async probe(svc: ServiceDefinition): Promise<{ online: boolean; responseMs: number | null }> {
    // Prefer per-service DNS (docker-compose network) so each peer is
    // reachable at its container hostname; fall back to a single override
    // host only when explicitly configured (local dev all on 127.0.0.1).
    const host = this.hostOverride ?? svc.name;
    const url = `http://${host}:${svc.port}/health`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
      return { online: res.status < 500, responseMs: Date.now() - t0 };
    } catch {
      return { online: false, responseMs: null };
    }
  }

  // ─── Control: Docker → process fallback ──────────────────────────────

  private async control(
    name: string,
    action: 'start' | 'stop' | 'restart',
  ): Promise<{ ok: boolean; message: string }> {
    // docker.ping() actually tests daemon reachability (isAvailable() only
    // tests if the constructor succeeded, which always passes on Windows).
    const dockerReachable = await this.docker.ping();
    if (dockerReachable) {
      return this.dockerControl(name, action);
    }
    return this.processControl(name, action);
  }

  // ─── Docker control ───────────────────────────────────────────────────

  private async dockerControl(
    name: string,
    action: 'start' | 'stop' | 'restart',
  ): Promise<{ ok: boolean; message: string }> {
    try {
      const containers = await this.docker.getClient().listContainers({ all: true });
      const LABEL = 'com.docker.compose.service';
      const match = containers.find((c) => (c.Labels ?? {})[LABEL] === name);

      // No Compose container found → this is a local dev env; use process control
      if (!match) {
        this.logger.warn(`No container for "${name}" — falling back to process control`);
        return this.processControl(name, action);
      }

      const container = this.docker.getClient().getContainer(match.Id);
      if (action === 'start')   await container.start();
      else if (action === 'stop') await container.stop();
      else                        await container.restart();

      this.logger.log(`Docker ${action}: ${name}`);
      const svc = SERVICES.find((s) => s.name === name)!;
      setTimeout(() => void this.checkOne(svc), 2_500);

      const verb = action === 'restart' ? 'reiniciado' : action === 'stop' ? 'parado' : 'iniciado';
      return { ok: true, message: `${name} ${verb} com sucesso` };
    } catch (err) {
      // Any Docker error → fall back to process control
      this.logger.warn(`Docker ${action} error for "${name}": ${String(err)} — falling back to process control`);
      return this.processControl(name, action);
    }
  }

  // ─── Process control (dev mode / no Docker) ──────────────────────────

  /**
   * Find the PID of the process LISTENING on `port` by parsing `netstat -ano`
   * directly (no findstr pipe — avoids false substring matches like :40010
   * matching when searching for :4001).
   *
   * Windows netstat columns: Proto  LocalAddress  ForeignAddress  State  PID
   * e.g.  "  TCP    127.0.0.1:4001    0.0.0.0:0    LISTENING    12345"
   */
  private async findPidByPort(port: number): Promise<number | null> {
    try {
      const { stdout } = await exec('netstat -ano');
      const portStr = String(port);

      for (const raw of stdout.split('\n')) {
        const line = raw.trim();
        // Only care about TCP LISTENING rows
        if (!line.startsWith('TCP') || !/LISTENING/i.test(line)) continue;

        // Split on whitespace → [Proto, LocalAddr, ForeignAddr, State, PID]
        const cols = line.split(/\s+/);
        if (cols.length < 5) continue;

        const localAddr = cols[1] ?? ''; // e.g. "127.0.0.1:4001" or "[::]:4001"
        // Extract the port: everything after the last ':'
        const addrPort = localAddr.split(':').pop() ?? '';
        if (addrPort !== portStr) continue;

        const pid = parseInt(cols[4] ?? '', 10);
        if (!isNaN(pid) && pid > 0) return pid;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Kill the process listening on `port`. Returns true if a process was killed.
   */
  private async killByPort(port: number): Promise<boolean> {
    const pid = await this.findPidByPort(port);
    if (!pid) return false;
    try {
      // /T kills the whole tree (child processes too)
      await exec(`taskkill /F /T /PID ${pid}`);
      this.logger.log(`Killed PID ${pid} (port ${port})`);
      return true;
    } catch (err) {
      this.logger.warn(`taskkill failed for PID ${pid}: ${String(err)}`);
      return false;
    }
  }

  /**
   * Spawn `pnpm run dev` inside the service directory, detached so it outlives
   * this process and is managed by the OS process table.
   */
  private spawnService(name: string): void {
    const cwd = path.join(this.servicesDir, name);
    this.logger.log(`Spawning ${name} in ${cwd}`);

    const child = spawn('pnpm', ['run', 'dev'], {
      cwd,
      detached: true,
      stdio: 'ignore',
      shell: true,      // needed on Windows so PATH resolves pnpm
      windowsHide: true,
    });
    child.unref(); // don't keep the developer-service process alive for this child

    this.logger.log(`Spawned ${name} (child pid: ${child.pid ?? 'unknown'})`);
  }

  /**
   * Process-based control for dev/local environments (no Docker).
   */
  private async processControl(
    name: string,
    action: 'start' | 'stop' | 'restart',
  ): Promise<{ ok: boolean; message: string }> {
    const svc = SERVICES.find((s) => s.name === name);
    if (!svc) return { ok: false, message: `Serviço desconhecido: ${name}` };

    try {
      // ── Stop phase ─────────────────────────────────────────────────
      if (action === 'stop' || action === 'restart') {
        const killed = await this.killByPort(svc.port);
        if (!killed && action === 'stop') {
          return {
            ok: false,
            message: `Nenhum processo encontrado na porta ${svc.port} para "${name}"`,
          };
        }
        if (action === 'restart') {
          // Brief pause so the port is freed before we respawn
          await new Promise<void>((r) => setTimeout(r, 1_500));
        }
      }

      // ── Start phase ────────────────────────────────────────────────
      if (action === 'start' || action === 'restart') {
        // If it's already running (start called while online), warn
        if (action === 'start') {
          const { online } = await this.probe(svc);
          if (online) {
            return { ok: false, message: `${name} já está em execução na porta ${svc.port}` };
          }
        }
        this.spawnService(name);
      }

      // Schedule a health probe so the UI refreshes quickly
      const svcDef = SERVICES.find((s) => s.name === name)!;
      setTimeout(() => void this.checkOne(svcDef), 4_000);

      const verb =
        action === 'restart' ? 'reiniciado' : action === 'stop' ? 'parado' : 'iniciado';
      return { ok: true, message: `${name} ${verb} com sucesso` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`processControl ${action} ${name}: ${msg}`);
      return { ok: false, message: `Erro ao ${action} "${name}": ${msg}` };
    }
  }
}
