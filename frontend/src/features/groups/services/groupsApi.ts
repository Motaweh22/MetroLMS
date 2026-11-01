import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  TrainingGroup,
  GroupMetrics,
  GroupRenewalCycle,
  GroupMember,
  GroupJoinRequest,
  GroupMaterialFolder,
  GroupMaterialFile,
  TraineeCourseAttemptStats,
} from '@/core/groups/types';
import type {
  CreateGroupRequestDTO,
  UpdateGroupRequestDTO,
  AssignCycleCoursesDTO,
  RenewGroupCycleRequestDTO,
  JoinGroupQRRequestDTO,
  JoinGroupQRResponseDTO,
  RotateGroupQRCodeResponseDTO,
  GroupSummaryDTO,
  CreateMaterialFolderDTO,
  UpdateMaterialFolderDTO,
  AddMaterialFileRequestDTO,
  ReplaceMaterialFileRequestDTO,
  GroupPreviewInfoDTO,
  CandidateTraineeDTO,
  CandidateLecturerDTO,
} from '@/core/groups/dtos';

export type EnrichedTrainingGroup = TrainingGroup & {
  metrics: GroupMetrics | null;
};

export type AdminEnrichedTrainingGroup = TrainingGroup & {
  metrics: GroupMetrics | null;
  currentCycle: GroupRenewalCycle | null;
  summary: GroupSummaryDTO | null;
};

/**
 * Training Groups Client Service Layer
 *
 * Exposes typed REST API methods for training cohorts, renewal cycles,
 * multi-attempt tracking, QR self-enrollment, group materials, and progress monitoring.
 */
export const groupsApi = {
  // ── 1. Trainee View Operations ───────────────────────────────────────

  /**
   * Fetch groups assigned to the currently authenticated user (Increment 7 trainee view)
   */
  async getMyGroups(options?: RequestOptions): Promise<EnrichedTrainingGroup[]> {
    return apiClient<EnrichedTrainingGroup[]>('/api/groups/my', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetch single group details by ID with strict membership authorization (Trainee view)
   */
  async getGroupById(groupId: string, options?: RequestOptions): Promise<EnrichedTrainingGroup> {
    return apiClient<EnrichedTrainingGroup>(`/api/groups/${encodeURIComponent(groupId)}`, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetch public preview info for a QR enrollment code prior to confirming enrollment
   */
  async getJoinInfo(code: string, options?: RequestOptions): Promise<GroupPreviewInfoDTO> {
    return apiClient<GroupPreviewInfoDTO>(`/api/groups/join/${encodeURIComponent(code)}/info`, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Join or request to join a group using a QR enrollment code
   */
  async joinGroupByQR(
    dto: JoinGroupQRRequestDTO,
    options?: RequestOptions
  ): Promise<JoinGroupQRResponseDTO> {
    return apiClient<JoinGroupQRResponseDTO>('/api/groups/join', {
      method: 'POST',
      body: JSON.stringify(dto),
      ...options,
    });
  },

  // ── 2. Admin & Supervisor Cohort Management ──────────────────────────

  /**
   * List all training groups with aggregate metrics (Admin: all, Supervisor: assigned only)
   */
  async getAdminGroups(options?: RequestOptions): Promise<GroupSummaryDTO[]> {
    return apiClient<GroupSummaryDTO[]>('/api/admin/groups', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Create a new training group with baseline schedule, policies, and initial courses (Admin only)
   */
  async createGroup(
    dto: CreateGroupRequestDTO,
    options?: RequestOptions
  ): Promise<TrainingGroup> {
    return apiClient<TrainingGroup>('/api/admin/groups', {
      method: 'POST',
      body: JSON.stringify(dto),
      ...options,
    });
  },

  /**
   * Fetch detailed group configuration, current cycle, and summary metrics (Admin or Assigned Supervisor)
   */
  async getAdminGroupById(
    groupId: string,
    options?: RequestOptions
  ): Promise<AdminEnrichedTrainingGroup> {
    return apiClient<AdminEnrichedTrainingGroup>(
      `/api/admin/groups/${encodeURIComponent(groupId)}`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Update training group settings, schedule, capacity, or policies (Admin only)
   */
  async updateGroup(
    groupId: string,
    dto: UpdateGroupRequestDTO,
    options?: RequestOptions
  ): Promise<TrainingGroup> {
    return apiClient<TrainingGroup>(`/api/admin/groups/${encodeURIComponent(groupId)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
      ...options,
    });
  },

  /**
   * Safe delete or safe archive a training group (Admin only)
   */
  async deleteGroup(
    groupId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string; archivedInstead?: boolean }> {
    return apiClient<{ success: boolean; message: string; archivedInstead?: boolean }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
  },

  // ── 3. Renewal Cycles & Course Assignments ───────────────────────────

  /**
   * Start a new renewal cycle for a group with fresh core/reminder course assignments (Admin only)
   */
  async renewCycle(
    groupId: string,
    dto: RenewGroupCycleRequestDTO,
    options?: RequestOptions
  ): Promise<{
    previousCycle: GroupRenewalCycle | null;
    newCycle: GroupRenewalCycle;
    group: TrainingGroup;
  }> {
    return apiClient<{
      previousCycle: GroupRenewalCycle | null;
      newCycle: GroupRenewalCycle;
      group: TrainingGroup;
    }>(`/api/admin/groups/${encodeURIComponent(groupId)}/renew`, {
      method: 'POST',
      body: JSON.stringify(dto),
      ...options,
    });
  },

  /**
   * Check and execute automatic renewal if due (scheduled date reached)
   */
  async checkAutoRenewal(
    groupId: string,
    options?: RequestOptions
  ): Promise<{
    renewed: boolean;
    cycle?: GroupRenewalCycle;
    successorGroup?: TrainingGroup;
    archivedGroup?: TrainingGroup;
    group: TrainingGroup;
  }> {
    return apiClient<{
      renewed: boolean;
      cycle?: GroupRenewalCycle;
      successorGroup?: TrainingGroup;
      archivedGroup?: TrainingGroup;
      group: TrainingGroup;
    }>(`/api/admin/groups/${encodeURIComponent(groupId)}/check-auto-renewal`, {
      method: 'POST',
      ...options,
    });
  },

  /**
   * Check and process automatic renewal for all eligible groups whose scheduled date is reached (Batch)
   */
  async checkAllDueRenewals(
    options?: RequestOptions
  ): Promise<{
    totalChecked: number;
    renewedCount: number;
    renewedGroupIds: string[];
    createdGroupIds?: string[];
  }> {
    return apiClient<{
      totalChecked: number;
      renewedCount: number;
      renewedGroupIds: string[];
      createdGroupIds?: string[];
    }>('/api/admin/groups/check-all-due-renewals', {
      method: 'POST',
      ...options,
    });
  },

  /**
   * List all historical and active cycles for a group
   */
  async getGroupCycles(groupId: string, options?: RequestOptions): Promise<GroupRenewalCycle[]> {
    return apiClient<GroupRenewalCycle[]>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/cycles`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Retrieve a specific renewal cycle by ID
   */
  async getGroupCycleById(
    groupId: string,
    cycleId: string,
    options?: RequestOptions
  ): Promise<GroupRenewalCycle> {
    return apiClient<GroupRenewalCycle>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/cycles/${encodeURIComponent(cycleId)}`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Assign or update courses and core/reminder roles in a cycle (Admin only)
   */
  async assignCycleCourses(
    groupId: string,
    dto: AssignCycleCoursesDTO & { cycleId?: string },
    options?: RequestOptions
  ): Promise<GroupRenewalCycle> {
    return apiClient<GroupRenewalCycle>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/courses`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  // ── 4. Group Members & Direct Enrollment ─────────────────────────────

  /**
   * List all active members of a group (Admin or Assigned Supervisor)
   */
  async getGroupMembers(groupId: string, options?: RequestOptions): Promise<GroupMember[]> {
    return apiClient<GroupMember[]>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * List all available candidate trainees for direct group membership assignment (Admin or Lecturer)
   */
  async getCandidateTrainees(options?: RequestOptions): Promise<CandidateTraineeDTO[]> {
    return apiClient<CandidateTraineeDTO[]>('/api/admin/trainees', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * List all eligible lecturer accounts for group primary instructor / assistant lecturer assignment (Admin or Lecturer)
   */
  async getCandidateLecturers(options?: RequestOptions): Promise<CandidateLecturerDTO[]> {
    return apiClient<CandidateLecturerDTO[]>('/api/admin/lecturers', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Update a training group's assigned assistant lecturers (Admin or Group Primary Instructor only)
   */
  async updateGroupAssistants(
    groupId: string,
    assistantLecturerIds: string[],
    options?: RequestOptions
  ): Promise<TrainingGroup> {
    return apiClient<TrainingGroup>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/assistants`,
      {
        method: 'PUT',
        body: JSON.stringify({ assistantLecturerIds }),
        ...options,
      }
    );
  },

  /**
   * Add trainees directly to a training group with idempotent course enrollment (Admin or Assigned Supervisor)
   */
  async addGroupMembers(
    groupId: string,
    traineeIds: string[],
    options?: RequestOptions
  ): Promise<{ addedCount: number; alreadyMemberCount: number; members: GroupMember[] }> {
    return apiClient<{ addedCount: number; alreadyMemberCount: number; members: GroupMember[] }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ traineeIds }),
        ...options,
      }
    );
  },

  /**
   * Remove a member from a training group (Admin or Assigned Supervisor)
   */
  async removeGroupMember(
    groupId: string,
    userId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
  },

  // ── 5. QR Code Token Lifecycle & Join Requests ───────────────────────

  /**
   * Regenerate the enrollment token, invalidating prior QR codes (Admin only)
   */
  async rotateQRCode(
    groupId: string,
    options?: RequestOptions
  ): Promise<RotateGroupQRCodeResponseDTO> {
    return apiClient<RotateGroupQRCodeResponseDTO>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/qr-code/rotate`,
      {
        method: 'POST',
        ...options,
      }
    );
  },

  /**
   * Toggle enrollment open or closed for a group (Admin only)
   */
  async toggleQRCode(
    groupId: string,
    isOpen: boolean,
    options?: RequestOptions
  ): Promise<{ success: boolean; isEnrollmentOpen: boolean }> {
    return apiClient<{ success: boolean; isEnrollmentOpen: boolean }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/qr-code/toggle`,
      {
        method: 'POST',
        body: JSON.stringify({ isOpen }),
        ...options,
      }
    );
  },

  /**
   * List join requests for a group (Admin or Assigned Supervisor)
   */
  async getJoinRequests(
    groupId: string,
    status?: 'pending' | 'approved' | 'rejected',
    options?: RequestOptions
  ): Promise<GroupJoinRequest[]> {
    const url = status
      ? `/api/admin/groups/${encodeURIComponent(groupId)}/join-requests?status=${encodeURIComponent(status)}`
      : `/api/admin/groups/${encodeURIComponent(groupId)}/join-requests`;

    return apiClient<GroupJoinRequest[]>(url, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Review (approve or reject) an applicant's join request (Admin or Assigned Supervisor)
   */
  async reviewJoinRequest(
    groupId: string,
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewNote?: string,
    options?: RequestOptions
  ): Promise<{
    request: GroupJoinRequest;
    group: TrainingGroup;
    newlyEnrolledCoursesCount?: number;
  }> {
    return apiClient<{
      request: GroupJoinRequest;
      group: TrainingGroup;
      newlyEnrolledCoursesCount?: number;
    }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/join-requests/${encodeURIComponent(requestId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, reviewNote }),
        ...options,
      }
    );
  },

  // ── 6. Group Materials Library ───────────────────────────────────────

  /**
   * List folders and files for a group (filtered for trainees)
   */
  async getGroupMaterials(
    groupId: string,
    cycleId?: string,
    options?: RequestOptions
  ): Promise<{ folders: (GroupMaterialFolder & { files: GroupMaterialFile[] })[]; rootFiles?: GroupMaterialFile[] }> {
    const url = cycleId
      ? `/api/admin/groups/${encodeURIComponent(groupId)}/materials?cycleId=${encodeURIComponent(cycleId)}`
      : `/api/admin/groups/${encodeURIComponent(groupId)}/materials`;

    return apiClient<{ folders: (GroupMaterialFolder & { files: GroupMaterialFile[] })[]; rootFiles?: GroupMaterialFile[] }>(url, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Create a material folder (Admin or Assigned Supervisor)
   */
  async createMaterialFolder(
    groupId: string,
    dto: CreateMaterialFolderDTO,
    options?: RequestOptions
  ): Promise<GroupMaterialFolder> {
    return apiClient<GroupMaterialFolder>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/folders`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  /**
   * Update folder name, visibility, or order (Admin or Assigned Supervisor)
   */
  async updateMaterialFolder(
    groupId: string,
    folderId: string,
    dto: UpdateMaterialFolderDTO,
    options?: RequestOptions
  ): Promise<GroupMaterialFolder> {
    return apiClient<GroupMaterialFolder>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/folders/${encodeURIComponent(folderId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  /**
   * Delete a folder and its files (Admin or Assigned Supervisor)
   */
  async deleteMaterialFolder(
    groupId: string,
    folderId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; deletedFilesCount: number }> {
    return apiClient<{ success: boolean; deletedFilesCount: number }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/folders/${encodeURIComponent(folderId)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
  },

  /**
   * Add a file record to a folder (Admin or Assigned Supervisor)
   */
  async addMaterialFile(
    groupId: string,
    dto: AddMaterialFileRequestDTO,
    options?: RequestOptions
  ): Promise<GroupMaterialFile> {
    return apiClient<GroupMaterialFile>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/files`,
      {
        method: 'POST',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  /**
   * Replace an existing file record with updated metadata (Admin or Assigned Supervisor)
   */
  async replaceMaterialFile(
    groupId: string,
    fileId: string,
    dto: ReplaceMaterialFileRequestDTO,
    options?: RequestOptions
  ): Promise<GroupMaterialFile> {
    return apiClient<GroupMaterialFile>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/files/${encodeURIComponent(fileId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  /**
   * Delete a file record from a folder (Admin or Assigned Supervisor)
   */
  async deleteMaterialFile(
    groupId: string,
    fileId: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/files/${encodeURIComponent(fileId)}`,
      {
        method: 'DELETE',
        ...options,
      }
    );
  },

  /**
   * Move a file record to another folder in the same group (Admin or Assigned Supervisor)
   */
  async moveMaterialFile(
    groupId: string,
    fileId: string,
    targetFolderId: string,
    options?: RequestOptions
  ): Promise<GroupMaterialFile> {
    return apiClient<GroupMaterialFile>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/files/${encodeURIComponent(fileId)}/move`,
      {
        method: 'PUT',
        body: JSON.stringify({ targetFolderId }),
        ...options,
      }
    );
  },

  /**
   * Update title or visibility of a material file (Admin or Assigned Supervisor)
   */
  async updateMaterialFile(
    groupId: string,
    fileId: string,
    dto: { title?: string; isVisible?: boolean },
    options?: RequestOptions
  ): Promise<GroupMaterialFile> {
    return apiClient<GroupMaterialFile>(
      `/api/admin/groups/${encodeURIComponent(groupId)}/materials/files/${encodeURIComponent(fileId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(dto),
        ...options,
      }
    );
  },

  // ── 7. Course Attempt Ledger & Progress Monitoring ───────────────────

  /**
   * Retrieve attempt history and statistics for a trainee on a course (Admin, Self, or Assigned Supervisor)
   */
  async getTraineeCourseAttempts(
    userId: string,
    courseId: string,
    cycleId?: string,
    options?: RequestOptions
  ): Promise<TraineeCourseAttemptStats> {
    const url = cycleId
      ? `/api/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/attempts?cycleId=${encodeURIComponent(cycleId)}`
      : `/api/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/attempts`;

    return apiClient<TraineeCourseAttemptStats>(url, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Retrieve group monitoring dashboard data (Admin or Assigned Supervisor)
   */
  async getGroupMonitoringData(
    groupId: string,
    cycleId?: string,
    options?: RequestOptions
  ): Promise<GroupMetrics> {
    const url = cycleId
      ? `/api/admin/groups/${encodeURIComponent(groupId)}/monitoring?cycleId=${encodeURIComponent(cycleId)}`
      : `/api/admin/groups/${encodeURIComponent(groupId)}/monitoring`;

    return apiClient<GroupMetrics>(url, {
      method: 'GET',
      ...options,
    });
  },
};
