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

export interface CourseVisibilityItem {
  id: string;
  title: string;
  lifecycleStatus: string;
  accessMode: string;
  targetDepartmentIds: string[];
  targetJobTitleIds: string[];
  targetLeadershipTitles?: string[];
}

export interface OrgDepartmentOption {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface OrgJobTitleOption {
  id: string;
  nameAr: string;
  nameEn: string;
  departmentId: string | null;
  departmentNameAr: string | null;
}

export interface CourseVisibilityCatalogResponse {
  courses: CourseVisibilityItem[];
  departments: OrgDepartmentOption[];
  jobTitles: OrgJobTitleOption[];
  leadershipTitles?: string[];
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

  /**
   * Fetches courses, departments, and job titles for full-width visibility configuration.
   */
  async getCourseVisibilityCatalog(): Promise<CourseVisibilityCatalogResponse> {
    return apiClient<CourseVisibilityCatalogResponse>('/api/admin/course-visibility', {
      method: 'GET',
    });
  },

  /**
   * Updates target departments and job titles for a specific course.
   */
  async updateCourseVisibility(
    courseId: string,
    targetDepartmentIds: string[],
    targetJobTitleIds: string[],
    targetLeadershipTitles: string[] = []
  ): Promise<{
    courseId: string;
    targetDepartmentIds: string[];
    targetJobTitleIds: string[];
    targetLeadershipTitles?: string[];
    message?: string;
  }> {
    return apiClient(
      `/api/admin/course-visibility/course/${encodeURIComponent(courseId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ targetDepartmentIds, targetJobTitleIds, targetLeadershipTitles }),
      }
    );
  },

  /**
   * Updates assigned courses for a specific department, job title, or leadership title.
   */
  async updateScopeCourseVisibility(
    scopeType: 'department' | 'job_title' | 'leadership',
    scopeId: string,
    courseIds: string[]
  ): Promise<{
    updated: boolean;
    scopeType: 'department' | 'job_title' | 'leadership';
    scopeId: string;
    courseIds: string[];
    message?: string;
  }> {
    return apiClient('/api/admin/course-visibility/scope', {
      method: 'PUT',
      body: JSON.stringify({ scopeType, scopeId, courseIds }),
    });
  },
};
