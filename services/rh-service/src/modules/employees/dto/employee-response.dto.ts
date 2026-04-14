/**
 * Output shapes for the employees controller. Kept as interfaces
 * (not classes) because these are response bodies — the
 * ValidationPipe doesn't run on outbound payloads.
 */

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
  /** Short-lived signed URL; only populated on the detail endpoint. */
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

export interface DocumentUploadResponse {
  document: EmployeeDocumentDto;
  message: string;
}

export interface DocumentDeleteResponse {
  message: string;
  documentId: string;
}
