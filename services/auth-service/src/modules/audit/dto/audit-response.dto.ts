export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  resourceId: string | null;
  meta: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface PaginatedAuditResponse {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
