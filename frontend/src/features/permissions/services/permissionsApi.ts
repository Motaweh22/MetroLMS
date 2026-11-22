import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  UserRole,
  PermissionKey,
  RolePermissionsConfig,
  UserPermissionOverride,
  EffectiveUserPermissions,
  ApprovalRequest,
} from '@/core/permissions/types';

/**
 * Centrally Managed Permissions & Governance API Service Layer (Increment 11 Phase 4)
 */
export const permissionsApi = {
  /**
   * Fetches baseline permissions for all roles
   */
  async getRolePermissions(options?: RequestOptions): Promise<RolePermissionsConfig[]> {
    const res = await apiClient<RolePermissionsConfig[] | { roles: RolePermissionsConfig[] }>(
      '/api/admin/permissions/roles',
      {
        method: 'GET',
        ...options,
      }
    );
    return Array.isArray(res) ? res : (res?.roles ?? []);
  },

  /**
   * Updates baseline permissions for a role
   */
  async updateRolePermissions(
    role: UserRole,
    permissions: PermissionKey[],
    options?: RequestOptions
  ): Promise<RolePermissionsConfig> {
    const res = await apiClient<RolePermissionsConfig | { role: RolePermissionsConfig }>(
      `/api/admin/permissions/roles/${encodeURIComponent(role)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
        ...options,
      }
    );
    if ('role' in res && typeof res.role === 'object' && res.role !== null) {
      return res.role;
    }
    return res as RolePermissionsConfig;
  },

  /**
   * Fetches permission override for a specific user
   */
  async getUserPermissionOverride(
    userId: string,
    options?: RequestOptions
  ): Promise<{ override: UserPermissionOverride | null }> {
    return apiClient<{ override: UserPermissionOverride | null }>(
      `/api/admin/permissions/users/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Saves or updates permission override for a user
   */
  async setUserPermissionOverride(
    userId: string,
    override: Omit<UserPermissionOverride, 'updatedAt'>,
    options?: RequestOptions
  ): Promise<UserPermissionOverride> {
    return apiClient<UserPermissionOverride>(
      `/api/admin/permissions/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(override),
        ...options,
      }
    );
  },

  /**
   * Deletes permission override for a user (resets to role baseline)
   */
  async deleteUserPermissionOverride(
    userId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/admin/permissions/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
  },

  /**
   * Computes effective permissions for a user
   */
  async getEffectiveUserPermissions(
    userId: string,
    options?: RequestOptions
  ): Promise<EffectiveUserPermissions> {
    return apiClient<EffectiveUserPermissions>(
      `/api/admin/permissions/effective/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Gets delegated operational authority status for a user
   */
  async getDelegatedAuthority(
    userId: string,
    options?: RequestOptions
  ): Promise<{ userId: string; enabled: boolean }> {
    return apiClient<{ userId: string; enabled: boolean }>(
      `/api/admin/permissions/governance/delegation/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Sets delegated operational authority status for a user
   */
  async setDelegatedAuthority(
    userId: string,
    enabled: boolean,
    options?: RequestOptions
  ): Promise<{ userId: string; enabled: boolean }> {
    return apiClient<{ userId: string; enabled: boolean }>(
      `/api/admin/permissions/governance/delegation/${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ enabled }),
        ...options,
      }
    );
  },

  /**
   * Gets all governance approval requests
   */
  async getApprovalRequests(options?: RequestOptions): Promise<ApprovalRequest[]> {
    const res = await apiClient<ApprovalRequest[] | { approvals: ApprovalRequest[] }>(
      '/api/admin/permissions/governance/approvals',
      {
        method: 'GET',
        ...options,
      }
    );
    return Array.isArray(res) ? res : (res?.approvals ?? []);
  },

  /**
   * Submits a governance approval request (dual control)
   */
  async createApprovalRequest(
    req: {
      actionType: string;
      targetId?: string;
      payload: Record<string, unknown>;
      justification: string;
    },
    options?: RequestOptions
  ): Promise<ApprovalRequest> {
    return apiClient<ApprovalRequest>('/api/admin/permissions/governance/approvals', {
      method: 'POST',
      body: JSON.stringify(req),
      ...options,
    });
  },

  /**
   * Approves a governance approval request
   */
  async approveApprovalRequest(
    id: string,
    notes?: string,
    options?: RequestOptions
  ): Promise<ApprovalRequest> {
    const res = await apiClient<ApprovalRequest | { approval: ApprovalRequest }>(
      `/api/admin/permissions/governance/approvals/${encodeURIComponent(id)}/decide`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'approve', reason: notes }),
        ...options,
      }
    );
    return 'approval' in res ? res.approval : res;
  },

  /**
   * Rejects a governance approval request
   */
  async rejectApprovalRequest(
    id: string,
    notes?: string,
    options?: RequestOptions
  ): Promise<ApprovalRequest> {
    const res = await apiClient<ApprovalRequest | { approval: ApprovalRequest }>(
      `/api/admin/permissions/governance/approvals/${encodeURIComponent(id)}/decide`,
      {
        method: 'POST',
        body: JSON.stringify({ decision: 'reject', reason: notes }),
        ...options,
      }
    );
    return 'approval' in res ? res.approval : res;
  },
};
