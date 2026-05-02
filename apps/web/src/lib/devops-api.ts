import { auth } from '@/auth';

/**
 * devops-api.ts — typed REST wrapper for the devops-service (port 3005).
 *
 * Mirrors the controllers under services/devops-service/src/modules/.
 */

export function getDevopsServiceUrl(): string {
  return (
    process.env.DEVOPS_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVOPS_SERVICE_URL ??
    process.env.NEXT_PUBLIC_DEVOPS_URL ??
    'http://127.0.0.1:4009'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('devops-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('devops-api: no active session');
  return session.accessToken;
}

async function request<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    accessToken?: string;
  } = {},
): Promise<ApiResult<T>> {
  const token = await resolveToken(init.accessToken);

  const params = init.query
    ? '?' +
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';

  const url = `${getDevopsServiceUrl()}${path}${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 503, data: { message: 'devops-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do devops-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

export type PipelineStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface Pipeline {
  id: string;
  projectId: string;
  status: PipelineStatus;
  ref: string;
  branch: string;
  workflowId: string;
  owner: string;
  repo: string;
  triggeredBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPipelines {
  items: Pipeline[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PipelineLogEntry {
  step: string;
  status: string;
  output: string;
  timestamp: string;
}

export interface Deployment {
  id: string;
  pipelineId: string;
  environment: string;
  service: string;
  imageTag: string;
  status: string;
  deployedBy: string | null;
  rolledBackBy: string | null;
  deployedAt: string;
  createdAt: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  uptime: number | null;
  lastCheckedAt: string | null;
  responseTimeMs: number | null;
  url: string | null;
}

// ---------------------------------------------------------------------------
// Pipelines
// ---------------------------------------------------------------------------

export interface ListPipelinesFilters {
  projectId?: string;
  status?: PipelineStatus;
  branch?: string;
  page?: number;
  pageSize?: number;
}

export async function listPipelines(
  filters: ListPipelinesFilters = {},
  accessToken?: string,
): Promise<ApiResult<PaginatedPipelines>> {
  return request<PaginatedPipelines>('/pipelines', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function getPipeline(
  id: string,
  accessToken?: string,
): Promise<ApiResult<Pipeline>> {
  return request<Pipeline>(`/pipelines/${encodeURIComponent(id)}`, {
    accessToken,
  });
}

export async function getPipelineLogs(
  id: string,
  accessToken?: string,
): Promise<ApiResult<PipelineLogEntry[]>> {
  return request<PipelineLogEntry[]>(`/pipelines/${encodeURIComponent(id)}/logs`, {
    accessToken,
  });
}

export interface TriggerPipelineInput {
  projectId: string;
  owner: string;
  repo: string;
  workflowId: string;
  ref: string;
  inputs?: Record<string, string>;
}

export async function triggerPipeline(
  input: TriggerPipelineInput,
  accessToken?: string,
): Promise<ApiResult<Pipeline>> {
  return request<Pipeline>('/pipelines/trigger', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

export async function listDeployments(
  accessToken?: string,
): Promise<ApiResult<Deployment[]>> {
  return request<Deployment[]>('/deployments', { accessToken });
}

export async function rollbackDeployment(
  id: string,
  accessToken?: string,
): Promise<ApiResult<Deployment>> {
  return request<Deployment>(`/deployments/${encodeURIComponent(id)}/rollback`, {
    method: 'POST',
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Services health (developer-service proxies)
// Developer-service exposes GET /services → array of ServiceSummary
// For the DevOps health page we hit the devops-service health endpoint.
// ---------------------------------------------------------------------------

export async function getServicesHealth(
  accessToken?: string,
): Promise<ApiResult<ServiceHealth[]>> {
  return request<ServiceHealth[]>('/health/services', { accessToken });
}
