import { auth } from '@/auth';

/**
 * rh-api.ts — typed REST wrapper for the rh-service (port 3002).
 *
 * Mirrors the controllers under services/rh-service/src/modules/.
 * Every public function resolves the Bearer token from the caller or
 * falls back to the NextAuth session (server-only).
 */

export function getRhServiceUrl(): string {
  return (
    process.env.RH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_RH_SERVICE_URL ??
    process.env.NEXT_PUBLIC_RH_URL ??
    'http://127.0.0.1:4002'
  );
}

async function resolveToken(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    throw new Error('rh-api: client-side calls require an explicit accessToken');
  }
  const session = await auth();
  if (!session?.accessToken) throw new Error('rh-api: no active session');
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

  const url = `${getRhServiceUrl()}${path}${params}`;
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
    return { ok: false, status: 503, data: { message: 'rh-service indisponível' } };
  }

  let data: T | { message?: string };
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: 'Resposta inválida do rh-service' };
  }
  return { ok: res.ok, status: res.status, data };
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | { message?: string | string[]; error?: string };
}

export interface EmployeePositionDto {
  id: string;
  name: string;
  level: string;
}

export interface EmployeeDepartmentDto {
  id: string;
  name: string;
}

export interface EmployeeManagerDto {
  id: string;
  name: string;
  email: string;
}

export interface EmployeeDocumentDto {
  id: string;
  name: string;
  type: string;
  fileKey: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  downloadUrl?: string;
}

export interface EmployeeListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  hireDate: string;
  dismissDate: string | null;
  position: EmployeePositionDto;
  department: EmployeeDepartmentDto;
  manager: EmployeeManagerDto | null;
}

export interface EmployeeDetail extends EmployeeListItem {
  phone: string | null;
  cpf: string;
  birthDate: string;
  userId: string | null;
  documents: EmployeeDocumentDto[];
  subordinates: EmployeeManagerDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEmployees {
  items: EmployeeListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VacationItem {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface PaginatedVacations {
  items: VacationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VacationActionResponse {
  id: string;
  status: string;
  message: string;
}

export interface WorkScheduleItem {
  id: string;
  employeeId: string;
  scheduleType: string;
  startDate: string;
  endDate: string | null;
  hoursPerDay: number;
  daysOfWeek: number[];
  createdAt: string;
}

export interface WorkScheduleHistoryResponse {
  items: WorkScheduleItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface ListEmployeesFilters {
  department?: string;
  position?: string;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listEmployees(
  filters: ListEmployeesFilters = {},
  accessToken?: string,
): Promise<ApiResult<PaginatedEmployees>> {
  return request<PaginatedEmployees>('/employees', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function getEmployee(
  id: string,
  accessToken?: string,
): Promise<ApiResult<EmployeeDetail>> {
  return request<EmployeeDetail>(`/employees/${encodeURIComponent(id)}`, {
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export interface PositionItem {
  id: string;
  name: string;
  level: string;
  description: string | null;
  salary: string | null;
  employeeCount: number;
}

export async function listPositions(accessToken?: string): Promise<ApiResult<PositionItem[]>> {
  return request<PositionItem[]>('/positions', { accessToken });
}

export async function createPosition(
  input: { name: string; level: string; description?: string; salary?: number },
  accessToken?: string,
): Promise<ApiResult<PositionItem>> {
  return request<PositionItem>('/positions', { method: 'POST', body: input, accessToken });
}

export async function updatePosition(
  id: string,
  input: { name?: string; level?: string; description?: string; salary?: number },
  accessToken?: string,
): Promise<ApiResult<PositionItem>> {
  return request<PositionItem>(`/positions/${encodeURIComponent(id)}`, {
    method: 'PUT', body: input, accessToken,
  });
}

export async function deletePosition(
  id: string,
  accessToken?: string,
): Promise<ApiResult<{ message: string; id: string }>> {
  return request<{ message: string; id: string }>(`/positions/${encodeURIComponent(id)}`, {
    method: 'DELETE', accessToken,
  });
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export interface DepartmentItem {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  employeeCount: number;
}

export async function listDepartments(accessToken?: string): Promise<ApiResult<DepartmentItem[]>> {
  return request<DepartmentItem[]>('/departments', { accessToken });
}

export async function createDepartment(
  input: { name: string; description?: string; managerId?: string },
  accessToken?: string,
): Promise<ApiResult<DepartmentItem>> {
  return request<DepartmentItem>('/departments', { method: 'POST', body: input, accessToken });
}

export async function updateDepartment(
  id: string,
  input: { name?: string; description?: string; managerId?: string | null },
  accessToken?: string,
): Promise<ApiResult<DepartmentItem>> {
  return request<DepartmentItem>(`/departments/${encodeURIComponent(id)}`, {
    method: 'PUT', body: input, accessToken,
  });
}

export async function deleteDepartment(
  id: string,
  accessToken?: string,
): Promise<ApiResult<{ message: string; id: string }>> {
  return request<{ message: string; id: string }>(`/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE', accessToken,
  });
}

export interface CreateEmployeeInput {
  name: string;
  email: string;
  phone?: string;
  cpf: string;
  birthDate: string;
  hireDate: string;
  positionId: string;
  departmentId: string;
  managerId?: string;
  userId?: string;
  salary?: number;
}

export async function createEmployee(
  input: CreateEmployeeInput,
  accessToken?: string,
): Promise<ApiResult<EmployeeDetail>> {
  return request<EmployeeDetail>('/employees', {
    method: 'POST',
    body: input,
    accessToken,
  });
}

export async function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput>,
  accessToken?: string,
): Promise<ApiResult<EmployeeDetail>> {
  return request<EmployeeDetail>(`/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
    accessToken,
  });
}

export async function deleteEmployee(
  id: string,
  accessToken?: string,
): Promise<ApiResult<{ message: string; id: string }>> {
  return request<{ message: string; id: string }>(
    `/employees/${encodeURIComponent(id)}`,
    { method: 'DELETE', accessToken },
  );
}

// ---------------------------------------------------------------------------
// Vacations
// ---------------------------------------------------------------------------

export interface ListVacationsFilters {
  employeeId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listVacations(
  filters: ListVacationsFilters = {},
  accessToken?: string,
): Promise<ApiResult<PaginatedVacations>> {
  return request<PaginatedVacations>('/vacations', {
    query: filters as Record<string, string | number | undefined>,
    accessToken,
  });
}

export async function approveVacation(
  id: string,
  accessToken?: string,
): Promise<ApiResult<VacationActionResponse>> {
  return request<VacationActionResponse>(
    `/vacations/${encodeURIComponent(id)}/approve`,
    { method: 'PUT', accessToken },
  );
}

export async function rejectVacation(
  id: string,
  reason: string,
  accessToken?: string,
): Promise<ApiResult<VacationActionResponse>> {
  return request<VacationActionResponse>(
    `/vacations/${encodeURIComponent(id)}/reject`,
    { method: 'PUT', body: { reason }, accessToken },
  );
}

// ---------------------------------------------------------------------------
// Work Schedules
// ---------------------------------------------------------------------------

export async function listWorkSchedules(
  employeeId: string,
  accessToken?: string,
): Promise<ApiResult<WorkScheduleHistoryResponse>> {
  return request<WorkScheduleHistoryResponse>(
    `/work-schedule/${encodeURIComponent(employeeId)}`,
    { accessToken },
  );
}
