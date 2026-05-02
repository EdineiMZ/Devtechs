import { auth } from '@/auth';

/**
 * projects-api.ts — typed REST wrapper for the projects-service (port 3004).
 *
 * Mirrors the controllers under services/projects-service/src/modules/.
 */

export function getProjectsServiceUrl(): string {
  return (
    process.env.PROJECTS_SERVICE_URL ??
    process.env.NEXT_PUBLIC_PROJECTS_SERVICE_URL ??
    process.env.NEXT_PUBLIC_PROJECTS_URL ??
    'http://127.0.0.1:4003'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('projects-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('projects-api: no active session');
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

  const url = `${getProjectsServiceUrl()}${path}${params}`;
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
    return { ok: false, status: 503, data: { message: 'projects-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do projects-service' };
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

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  owner: UserSummary;
  client: UserSummary | null;
  memberCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberDto {
  user: UserSummary;
  role: string;
  joinedAt: string;
}

export interface MilestoneDto {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  order: number;
}

export interface ProjectProgress {
  progressPercent: number;
  milestones: MilestoneDto[];
}

export interface ProjectDetail extends ProjectListItem {
  githubRepo: string | null;
  progressPercent: number;
  milestones: MilestoneDto[];
  members: ProjectMemberDto[];
}

export interface PaginatedProjects {
  items: ProjectListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface BoardTaskDto {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  order: number;
  assignee: UserSummary | null;
  reporter: UserSummary;
  estimatedHours: number | null;
  loggedHours: number;
  dueDate: string | null;
  labels: string[];
  parentId: string | null;
  subtaskCount: number;
  timeEntryCount: number;
  sprintId: string | null;
}

export interface BoardColumnDto {
  id: string;
  name: string;
  order: number;
  wipLimit: number | null;
  taskCount: number;
  overWipLimit: boolean;
  tasks: BoardTaskDto[];
}

export interface BoardResponse {
  board: {
    id: string;
    projectId: string;
    name: string;
  };
  columns: BoardColumnDto[];
}

export interface BurndownDataPoint {
  date: string;
  remaining: number;
  ideal: number;
  loggedOnDay: number;
}

export interface ActiveSprintResponse {
  sprint: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    status: string;
  };
  tasks: BoardTaskDto[];
  burndown: {
    totalHours: number;
    loggedHours: number;
    remainingHours: number;
    points: BurndownDataPoint[];
  };
}

export interface MoveTaskResponse {
  id: string;
  columnId: string;
  order: number;
  wipWarning: boolean;
}

export interface TaskDetail extends BoardTaskDto {
  projectId: string;
  columnId: string;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface ListProjectsFilters {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listProjects(
  filters: ListProjectsFilters = {},
  accessToken?: string,
): Promise<ApiResult<PaginatedProjects>> {
  return request<PaginatedProjects>('/projects', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function getProject(
  id: string,
  accessToken?: string,
): Promise<ApiResult<ProjectDetail>> {
  return request<ProjectDetail>(`/projects/${encodeURIComponent(id)}`, {
    accessToken,
  });
}

export async function getProjectBoard(
  projectId: string,
  accessToken?: string,
): Promise<ApiResult<BoardResponse>> {
  return request<BoardResponse>(`/projects/${encodeURIComponent(projectId)}/board`, {
    accessToken,
  });
}

export async function getActiveSprint(
  projectId: string,
  accessToken?: string,
): Promise<ApiResult<ActiveSprintResponse>> {
  return request<ActiveSprintResponse>(
    `/projects/${encodeURIComponent(projectId)}/sprint/active`,
    { accessToken },
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  assigneeId?: string;
  estimatedHours?: number;
  dueDate?: string;
  labels?: string[];
  sprintId?: string;
}

export async function createTask(
  input: CreateTaskInput,
  accessToken?: string,
): Promise<ApiResult<TaskDetail>> {
  return request<TaskDetail>('/tasks', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function moveTask(
  taskId: string,
  targetColumnId: string,
  newOrder: number,
  accessToken?: string,
): Promise<ApiResult<MoveTaskResponse>> {
  return request<MoveTaskResponse>(`/tasks/${encodeURIComponent(taskId)}/column`, {
    method: 'PUT',
    body: { targetColumnId, newOrder },
    accessToken,
  });
}

export async function updateTask(
  id: string,
  input: Partial<CreateTaskInput>,
  accessToken?: string,
): Promise<ApiResult<TaskDetail>> {
  return request<TaskDetail>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  dueDate?: string;
  order?: number;
}

export async function getProjectProgress(
  projectId: string,
  accessToken?: string,
): Promise<ApiResult<ProjectProgress>> {
  return request<ProjectProgress>(
    `/projects/${encodeURIComponent(projectId)}/progress`,
    { accessToken },
  );
}

export async function listMilestones(
  projectId: string,
  accessToken?: string,
): Promise<ApiResult<MilestoneDto[]>> {
  return request<MilestoneDto[]>(
    `/projects/${encodeURIComponent(projectId)}/milestones`,
    { accessToken },
  );
}

export async function createMilestone(
  projectId: string,
  input: CreateMilestoneInput,
  accessToken?: string,
): Promise<ApiResult<MilestoneDto>> {
  return request<MilestoneDto>(
    `/projects/${encodeURIComponent(projectId)}/milestones`,
    { method: 'POST', body: input, accessToken },
  );
}

export async function updateMilestone(
  projectId: string,
  milestoneId: string,
  input: Partial<CreateMilestoneInput> & { completedAt?: string | null },
  accessToken?: string,
): Promise<ApiResult<MilestoneDto>> {
  return request<MilestoneDto>(
    `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: 'PUT', body: input, accessToken },
  );
}

export async function deleteMilestone(
  projectId: string,
  milestoneId: string,
  accessToken?: string,
): Promise<ApiResult<{ message: string }>> {
  return request<{ message: string }>(
    `/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: 'DELETE', accessToken },
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export type ProjectMemberRole =
  | 'OWNER'
  | 'MANAGER'
  | 'DEVELOPER'
  | 'DESIGNER'
  | 'QA_ENGINEER'
  | 'SECURITY_ENGINEER'
  | 'DEVOPS'
  | 'VIEWER';

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
  accessToken: string,
): Promise<ApiResult<ProjectMemberDto>> {
  return request<ProjectMemberDto>(
    `/projects/${encodeURIComponent(projectId)}/members`,
    { method: 'POST', body: { userId, role }, accessToken },
  );
}

export async function updateProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
  accessToken: string,
): Promise<ApiResult<ProjectMemberDto>> {
  return request<ProjectMemberDto>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PUT', body: { role }, accessToken },
  );
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  accessToken: string,
): Promise<ApiResult<{ message: string }>> {
  return request<{ message: string }>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE', accessToken },
  );
}
