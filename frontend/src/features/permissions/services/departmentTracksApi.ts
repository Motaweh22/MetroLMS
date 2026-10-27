import { apiClient } from '@/core/api/apiClient';
import type {
  CanonicalDepartmentDTO,
  CanonicalTrackDTO,
  DepartmentPermissionDTO,
  UpdateDepartmentTracksResponseDTO,
} from '@/core/permissions/types';

export interface DepartmentTracksCatalogResponse {
  departments: DepartmentPermissionDTO[];
  canonicalDepartments: CanonicalDepartmentDTO[];
  tracks: CanonicalTrackDTO[];
}

export interface SingleDepartmentTracksResponse {
  department: DepartmentPermissionDTO;
  tracks: CanonicalTrackDTO[];
}

export const departmentTracksApi = {
  /**
   * Fetches all department track mappings along with canonical catalogs.
   */
  async getDepartmentTracksConfig(): Promise<DepartmentTracksCatalogResponse> {
    return apiClient<DepartmentTracksCatalogResponse>('/api/admin/department-tracks', {
      method: 'GET',
    });
  },

  /**
   * Fetches the track configuration for a single department.
   */
  async getDepartmentTracksById(departmentId: string): Promise<SingleDepartmentTracksResponse> {
    return apiClient<SingleDepartmentTracksResponse>(
      `/api/admin/department-tracks/${encodeURIComponent(departmentId)}`,
      {
        method: 'GET',
      }
    );
  },

  /**
   * Updates allowed tracks for a department.
   * If the actor is an assistant admin without delegation, creates a pending approval request.
   */
  async updateDepartmentTracks(
    departmentId: string,
    allowedTracks: string[],
    justification?: string
  ): Promise<UpdateDepartmentTracksResponseDTO> {
    return apiClient<UpdateDepartmentTracksResponseDTO>(
      `/api/admin/department-tracks/${encodeURIComponent(departmentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ allowedTracks, justification }),
      }
    );
  },
};
