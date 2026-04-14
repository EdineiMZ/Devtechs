/**
 * Response shapes for the vacations controller.
 *
 * Kept as interfaces (not classes) because these are outbound only —
 * the ValidationPipe does not run on response bodies.
 */

export interface VacationEmployeeSummary {
  id: string;
  name: string;
  email: string;
}

export interface VacationItem {
  id: string;
  employee: VacationEmployeeSummary;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: VacationEmployeeSummary | null;
  notes: string | null;
  rejectionReason: string | null;
  updatedAt: string;
}

export interface PaginatedVacations {
  items: VacationItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VacationActionResponse {
  message: string;
  vacation: VacationItem;
}
