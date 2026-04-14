export interface PermissionSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
}

export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  requireEmailVerified: boolean;
  require2FA: boolean;
  permissions: PermissionSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignRoleResponse {
  message: string;
  userId: string;
  roleId: string;
  assignedAt: string;
}

export interface UnassignRoleResponse {
  message: string;
  userId: string;
  roleId: string;
}
