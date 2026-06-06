import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../../redis/redis.service';

/**
 * Low-level HTTP client for the Hostinger VPS API.
 *
 * Base URL: https://developers.hostinger.com/api/vps/v1
 * Auth:     Bearer token from `HOSTINGER_API_TOKEN` env var.
 * Timeout:  10s per request via AbortSignal.timeout â€” anything slower
 *           is treated as the upstream being unreachable and surfaces
 *           as a 503 from our service.
 *
 * Error mapping:
 *   - 401/403 from upstream â†’ UnauthorizedException (token wrong / revoked)
 *   - 404 from upstream     â†’ returns null (caller decides 404 vs absent)
 *   - 409 from upstream     â†’ returns { alreadyInState: true }; the
 *                             actuator routes (start/stop/restart) treat
 *                             this as soft-success
 *   - timeout / network err â†’ ServiceUnavailableException with retry hint
 *   - any other 4xx/5xx     â†’ ServiceUnavailableException carrying the
 *                             upstream message
 *
 * All requests log the URL + status + elapsed; bodies are NEVER logged
 * because they contain IP addresses, hostnames and other PII.
 */

export interface HostingerVm {
  id: string;
  hostname: string;
  state: 'running' | 'stopped' | 'starting' | 'stopping' | 'rebooting' | string;
  plan: string;
  dataCenter: string;
  ipv4: string;
  ipv6?: string | null;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  createdAt: string;
}

/**
 * Raw shape returned by the Hostinger VPS API v1 â€” verified against
 * the real API response (GET /virtual-machines/{id}).
 *
 * Notable differences from `HostingerVm`:
 *   - `data_center_id`: integer, not a name string
 *   - `ipv4` / `ipv6`: arrays of IP objects, not plain strings
 *   - `disk`: in MB (divide by 1024 for GB)
 *   - `memory`: in MB
 *   - `created_at`: snake_case ISO string
 */
interface RawHostingerVm {
  id: number | string;
  hostname: string;
  state: string;
  plan: string;
  data_center_id?: number;
  /** IPv4 list â€” primary IP is ipv4[0].address. */
  ipv4?: Array<{ id?: number; address: string; ptr?: string }>;
  /** IPv6 list â€” primary IP is ipv6[0].address. */
  ipv6?: Array<{ id?: number; address: string; ptr?: string }>;
  cpus?: number;
  /** Memory in MB. */
  memory?: number;
  /** Disk in MB. */
  disk?: number;
  bandwidth?: number;
  created_at?: string;
  // Fields that may appear in older/newer API versions:
  cpuCores?: number;
  memoryMb?: number;
  diskGb?: number;
  createdAt?: string;
}

/** Raw shape from GET /data-centers */
export interface HostingerDataCenter {
  id: number;
  name: string;
  location: string;
  city: string;
  continent: string;
}

export interface HostingerMetricsPoint {
  timestamp: string; // ISO 8601
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkInKbps: number;
  networkOutKbps: number;
}

export interface HostingerMetricsResponse {
  vmId: string;
  windowStart: string;
  windowEnd: string;
  granularity: '1m' | '5m' | '1h';
  points: HostingerMetricsPoint[];
}

export interface HostingerAction {
  id: string;
  type: 'START' | 'STOP' | 'RESTART' | 'SNAPSHOT' | 'BACKUP' | string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;
  initiatedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface HostingerBackup {
  id: string;
  vmId: string;
  type: 'AUTOMATIC' | 'MANUAL';
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface HostingerSnapshot {
  id: string;
  vmId: string;
  label: string;
  sizeBytes: number;
  createdAt: string;
}

export interface HostingerSshKey {
  id: number;
  name: string;
  fingerprint: string;
  createdAt: string;
}

export interface HostingerOsTemplate {
  id: number;
  name: string;
  description: string;
}

/** PTR record for one IP address on a VM. */
export interface HostingerPtrRecord {
  ipAddress: string;
  ptr: string | null;
}

export interface HostingerFirewallGroup {
  id: number;
  name: string;
  createdAt: string;
}

export interface ReinstallVmInput {
  /** OS template ID from GET /os-templates. */
  templateId: number;
  /** Optional SSH key IDs to inject. */
  sshKeyIds?: number[];
}

export type ActuatorOutcome =
  | { ok: true; alreadyInState: false; actionId: string | null }
  | { ok: true; alreadyInState: true; message: string };

const DEFAULT_BASE_URL = 'https://developers.hostinger.com/api/vps/v1';
const REQUEST_TIMEOUT_MS = 10_000;
const API_KEYS_REDIS_KEY = 'SZDevs:config:api_keys';

@Injectable()
export class HostingerApiService {
  private readonly logger = new Logger(HostingerApiService.name);
  /** In-memory cache: data_center_id â†’ city name. Populated on first use. */
  private dcCache: Map<number, string> | null = null;
  private warnedMissingToken = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Resolves the Hostinger API token: Redis override (config panel) takes
   * precedence over the HOSTINGER_API_TOKEN env var. Looked up on every
   * request so panel saves apply without a service restart.
   */
  private async resolveToken(): Promise<string | undefined> {
    const overrides = await this.redis.hgetall(API_KEYS_REDIS_KEY);
    const token = overrides['HOSTINGER_API_TOKEN'] ?? this.config.get<string>('HOSTINGER_API_TOKEN');
    if (!token && !this.warnedMissingToken) {
      this.logger.warn(
        'HOSTINGER_API_TOKEN is not set (neither in Redis nor env). Hostinger VPS routes will fail with 503 until it is configured.',
      );
      this.warnedMissingToken = true;
    }
    return token || undefined;
  }

  /** Resolves the Hostinger API base URL with the same Redis-first precedence. */
  private async resolveBaseUrl(): Promise<string> {
    const overrides = await this.redis.hgetall(API_KEYS_REDIS_KEY);
    return (
      overrides['HOSTINGER_API_URL'] ||
      this.config.get<string>('HOSTINGER_API_URL', DEFAULT_BASE_URL)
    );
  }

  // ---------------------------------------------------------------------------
  // Public read methods
  // ---------------------------------------------------------------------------

  async listVMs(): Promise<HostingerVm[]> {
    const [rawUnknown, dcMap] = await Promise.all([
      this.request<unknown>('GET', '/virtual-machines'),
      this.getDataCenterMap(),
    ]);
    const raw = this.extractList<RawHostingerVm>(rawUnknown);
    return raw.map((r) => this.mapVm(r, dcMap));
  }

  async getVM(vmId: string): Promise<HostingerVm | null> {
    const [raw, dcMap] = await Promise.all([
      this.request<RawHostingerVm | null>(
        'GET',
        `/virtual-machines/${encodeURIComponent(vmId)}`,
        { allow404: true },
      ),
      this.getDataCenterMap(),
    ]);
    return raw ? this.mapVm(raw, dcMap) : null;
  }

  async listDataCenters(): Promise<HostingerDataCenter[]> {
    const raw = await this.request<unknown>('GET', '/data-centers');
    return this.extractList<HostingerDataCenter>(raw);
  }

  getVMMetrics(vmId: string): Promise<HostingerMetricsResponse> {
    return this.request<HostingerMetricsResponse>(
      'GET',
      `/virtual-machines/${encodeURIComponent(vmId)}/metrics`,
    );
  }

  getVMActions(vmId: string, page = 1, pageSize = 50): Promise<{ actions: HostingerAction[]; total: number }> {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return this.request<{ actions: HostingerAction[]; total: number }>(
      'GET',
      `/virtual-machines/${encodeURIComponent(vmId)}/actions?${qs.toString()}`,
    );
  }

  async listBackups(vmId: string): Promise<HostingerBackup[]> {
    const raw = await this.request<unknown>(
      'GET',
      `/virtual-machines/${encodeURIComponent(vmId)}/backups`,
    );
    return this.extractList<HostingerBackup>(raw);
  }

  async listSnapshots(vmId: string): Promise<HostingerSnapshot[]> {
    const raw = await this.request<unknown>(
      'GET',
      `/virtual-machines/${encodeURIComponent(vmId)}/snapshots`,
    );
    return this.extractList<HostingerSnapshot>(raw);
  }

  // ---------------------------------------------------------------------------
  // Actuator methods (start/stop/restart/snapshot)
  //
  // Each one returns `ActuatorOutcome` so the caller can branch between
  // "we triggered the action" and "the VM was already in the desired
  // state, no-op". The 409 tolerance exists because the Hostinger API
  // returns 409 when you ask to start a running VM (or stop a stopped
  // one). Surfacing that as a hard error in the UI would be confusing.
  // ---------------------------------------------------------------------------

  startVM(vmId: string): Promise<ActuatorOutcome> {
    return this.actuator('START', `/virtual-machines/${encodeURIComponent(vmId)}/start`);
  }

  stopVM(vmId: string): Promise<ActuatorOutcome> {
    return this.actuator('STOP', `/virtual-machines/${encodeURIComponent(vmId)}/stop`);
  }

  restartVM(vmId: string): Promise<ActuatorOutcome> {
    return this.actuator('RESTART', `/virtual-machines/${encodeURIComponent(vmId)}/restart`);
  }

  async createSnapshot(vmId: string, label?: string): Promise<HostingerSnapshot> {
    const body = label && label.trim() ? { label: label.trim() } : {};
    return this.request<HostingerSnapshot>(
      'POST',
      `/virtual-machines/${encodeURIComponent(vmId)}/snapshots`,
      { body },
    );
  }

  deleteSnapshot(vmId: string, snapshotId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/virtual-machines/${encodeURIComponent(vmId)}/snapshots/${encodeURIComponent(snapshotId)}`,
    );
  }

  restoreFromSnapshot(vmId: string, snapshotId: string): Promise<void> {
    return this.request<void>(
      'POST',
      `/virtual-machines/${encodeURIComponent(vmId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`,
    );
  }

  restoreFromBackup(vmId: string, backupId: string): Promise<void> {
    return this.request<void>(
      'POST',
      `/virtual-machines/${encodeURIComponent(vmId)}/backups/${encodeURIComponent(backupId)}/restore`,
    );
  }

  async listSshKeys(): Promise<HostingerSshKey[]> {
    const raw = await this.request<unknown>('GET', '/ssh-keys');
    return this.extractList<HostingerSshKey>(raw);
  }

  async listOsTemplates(): Promise<HostingerOsTemplate[]> {
    const raw = await this.request<unknown>('GET', '/os-templates');
    return this.extractList<HostingerOsTemplate>(raw);
  }

  reinstallVM(vmId: string, input: ReinstallVmInput): Promise<void> {
    return this.request<void>(
      'POST',
      `/virtual-machines/${encodeURIComponent(vmId)}/reinstall`,
      {
        body: {
          template_id: input.templateId,
          ...(input.sshKeyIds?.length ? { ssh_key_ids: input.sshKeyIds } : {}),
        },
      },
    );
  }

  getPtrRecords(vmId: string): Promise<HostingerPtrRecord[]> {
    return this.request<HostingerPtrRecord[]>(
      'GET',
      `/virtual-machines/${encodeURIComponent(vmId)}/ptr`,
    );
  }

  updatePtrRecord(vmId: string, ipAddress: string, ptr: string): Promise<HostingerPtrRecord> {
    return this.request<HostingerPtrRecord>(
      'PUT',
      `/virtual-machines/${encodeURIComponent(vmId)}/ptr`,
      { body: { ip_address: ipAddress, ptr } },
    );
  }

  async listFirewallGroups(): Promise<HostingerFirewallGroup[]> {
    const raw = await this.request<unknown>('GET', '/firewall');
    return this.extractList<HostingerFirewallGroup>(raw);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Transform the raw Hostinger API v1 response into the canonical `HostingerVm`.
   * Verified against the real API (2026-04-29):
   *   - ipv4/ipv6 are arrays of objects â†’ extract [0].address
   *   - data_center_id is an integer â†’ look up city name from dcMap
   *   - disk is in MB â†’ divide by 1024 for GB
   *   - memory is already in MB
   */
  private mapVm(raw: RawHostingerVm, dcMap: Map<number, string>): HostingerVm {
    // --- Primary IPs ---
    const ipv4Primary = Array.isArray(raw.ipv4) && raw.ipv4.length > 0
      ? (raw.ipv4[0]?.address ?? '')
      : '';
    const ipv6Primary = Array.isArray(raw.ipv6) && raw.ipv6.length > 0
      ? (raw.ipv6[0]?.address ?? null)
      : null;

    // --- Data center name ---
    const dataCenter = raw.data_center_id !== undefined
      ? (dcMap.get(raw.data_center_id) ?? `DC-${raw.data_center_id}`)
      : 'Unknown';

    // --- Resource counters ---
    // disk from API is in MB; divide by 1024 for GB (round up).
    const diskGb = raw.diskGb ?? (raw.disk !== undefined ? Math.ceil(raw.disk / 1024) : 0);
    const memoryMb = raw.memoryMb ?? raw.memory ?? 0;
    const cpuCores = raw.cpuCores ?? raw.cpus ?? 0;

    return {
      id: String(raw.id),
      hostname: raw.hostname,
      state: raw.state,
      plan: raw.plan,
      dataCenter,
      ipv4: ipv4Primary,
      ipv6: ipv6Primary,
      cpuCores,
      memoryMb,
      diskGb,
      createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    };
  }

  /**
   * Normalize a raw API response that may be either a plain array or an
   * envelope object like `{ data: [...] }` / `{ items: [...] }`.
   * Returns a guaranteed array (empty if the shape is unrecognised).
   */
  private extractList<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      for (const key of ['data', 'items', 'results']) {
        if (Array.isArray(obj[key])) return obj[key] as T[];
      }
    }
    return [];
  }

  /** Fetch and cache the data-center idâ†’city map. Falls back to empty map on error. */
  private async getDataCenterMap(): Promise<Map<number, string>> {
    if (this.dcCache) return this.dcCache;
    try {
      const list = await this.listDataCenters();
      this.dcCache = new Map(list.map((dc) => [dc.id, `${dc.city} (${dc.location.toUpperCase()})`]));
    } catch (err) {
      this.logger.warn(
        `Could not fetch data centers: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.dcCache = new Map();
    }
    return this.dcCache;
  }

  private async actuator(
    type: 'START' | 'STOP' | 'RESTART',
    path: string,
  ): Promise<ActuatorOutcome> {
    try {
      const response = await this.request<{ actionId?: string } | undefined>(
        'POST',
        path,
        { allow409: true },
      );
      // `request` returns the special sentinel below when 409 fires.
      if (response && (response as { __alreadyInState?: true }).__alreadyInState) {
        return {
          ok: true,
          alreadyInState: true,
          message: `VM is already in the requested state for ${type.toLowerCase()}`,
        };
      }
      return {
        ok: true,
        alreadyInState: false,
        actionId: (response as { actionId?: string })?.actionId ?? null,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'Hostinger API call failed',
      );
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    opts: { body?: unknown; allow404?: boolean; allow409?: boolean } = {},
  ): Promise<T> {
    const token = await this.resolveToken();
    if (!token) {
      throw new ServiceUnavailableException(
        'HOSTINGER_API_TOKEN is not configured. Salve o token no painel Developer ou defina HOSTINGER_API_TOKEN no ambiente.',
      );
    }
    const baseUrl = await this.resolveBaseUrl();
    const url = `${baseUrl}${path}`;
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetch(url, {
        method,
        headers: {
          // Bearer token authentication â€” the value comes from Redis
          // (SZDevs:config:api_keys) with HOSTINGER_API_TOKEN env as fallback.
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'SZDevs-developer-service/1.0',
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        // 10s budget. Anything slower => 503 with retry hint.
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      const reason = err instanceof Error ? err.message : String(err);
      if (reason.includes('aborted') || reason.includes('timeout')) {
        this.logger.warn(`[hostinger] ${method} ${path} TIMEOUT after ${elapsed}ms`);
        throw new ServiceUnavailableException(
          'Hostinger API timed out after 10s. The action was not performed; please retry.',
        );
      }
      this.logger.error(`[hostinger] ${method} ${path} network error after ${elapsed}ms: ${reason}`);
      throw new ServiceUnavailableException(
        `Hostinger API unreachable: ${reason}. Please retry in a few moments.`,
      );
    }

    const elapsed = Date.now() - startedAt;
    this.logger.log(`[hostinger] ${method} ${path} â†’ ${response.status} (${elapsed}ms)`);

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException(
        'Hostinger API rejected the bearer token. Check HOSTINGER_API_TOKEN.',
      );
    }

    if (opts.allow404 && response.status === 404) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return null as any;
    }

    if (opts.allow409 && response.status === 409) {
      // Soft-success sentinel â€” the actuator wrapper converts this into
      // ActuatorOutcome { alreadyInState: true }.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { __alreadyInState: true } as any;
    }

    if (!response.ok) {
      let message = `Hostinger API error ${response.status}`;
      try {
        const body = (await response.json()) as { message?: string; error?: string };
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        /* ignore â€” keep default */
      }
      throw new ServiceUnavailableException(message);
    }

    if (response.status === 204) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return undefined as any;
    }

    return (await response.json()) as T;
  }
}
