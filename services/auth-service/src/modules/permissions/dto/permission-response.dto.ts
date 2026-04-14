export interface PermissionItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
}

/**
 * Top-level response for `GET /permissions`. Permissions are grouped
 * by module so the admin UI can render one accordion per module
 * without an additional pass through the flat list.
 */
export interface PermissionsByModuleResponse {
  modules: {
    module: string;
    permissions: PermissionItem[];
  }[];
  total: number;
}

export interface GrantPermissionResponse {
  message: string;
  userId: string;
  permission: PermissionItem;
  assignedAt: string;
}

export interface RevokePermissionResponse {
  message: string;
  userId: string;
  permissionId: string;
}
