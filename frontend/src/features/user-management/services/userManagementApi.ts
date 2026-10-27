import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  ManagedUserDTO,
  UserFilterParams,
  CreateUserRequestDTO,
  UserRole,
  UserStatus,
  UserTranscriptDTO,
} from '@/core/user-management/types';

/**
 * Centrally Managed User Directory API Service Layer
 *
 * Exposes typed REST API methods for querying and mutating the centralized user directory.
 * Requires authenticated administrator credentials.
 */
export const userManagementApi = {
  /**
   * Fetch all managed users matching the specified filter criteria
   */
  async getManagedUsers(
    params?: UserFilterParams,
    options?: RequestOptions
  ): Promise<ManagedUserDTO[]> {
    const searchParams = new URLSearchParams();
    if (params?.query && params.query.trim()) {
      searchParams.set('query', params.query.trim());
    }
    if (params?.role && params.role !== 'all') {
      searchParams.set('role', params.role);
    }
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params?.department && params.department !== 'all') {
      searchParams.set('department', params.department);
    }

    const qs = searchParams.toString();
    const endpoint = `/api/admin/users${qs ? `?${qs}` : ''}`;
    return apiClient<ManagedUserDTO[]>(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Create a new user in the centralized user directory (Phase 2)
   */
  async createUser(
    dto: CreateUserRequestDTO,
    options?: RequestOptions
  ): Promise<ManagedUserDTO> {
    return apiClient<ManagedUserDTO>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(dto),
      ...options,
    });
  },

  /**
   * Update a user's role in the centralized user directory (Phase 2)
   */
  async updateUserRole(
    userId: string,
    role: UserRole,
    options?: RequestOptions
  ): Promise<ManagedUserDTO> {
    return apiClient<ManagedUserDTO>(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      ...options,
    });
  },

  /**
   * Update a user's account status (suspend / reactivate) in the centralized user directory (Phase 2)
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
    reason?: string,
    options?: RequestOptions
  ): Promise<ManagedUserDTO> {
    return apiClient<ManagedUserDTO>(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
      ...options,
    });
  },

  /**
   * Fetch a user's full learning transcript and course history (Phase 3)
   */
  async getUserTranscript(
    userId: string,
    options?: RequestOptions
  ): Promise<UserTranscriptDTO> {
    return apiClient<UserTranscriptDTO>(
      `/api/admin/users/${encodeURIComponent(userId)}/transcript`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Delete a user from the centralized user directory
   */
  async deleteUser(
    userId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message?: string; approvalRequired?: boolean; requestId?: string }> {
    return apiClient(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      ...options,
    });
  },
};

