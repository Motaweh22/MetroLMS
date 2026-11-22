import { apiClient } from '@/core/api/apiClient';
import type { User } from '@/core/auth/types';

export interface UserOverviewEnrolledCourse {
  id: string;
  title: string;
  lifecycleStatus: string;
  accessMode: string;
  sources: string[];
  enrolledAt: string | null;
  progressPercentage: number;
  isCompleted: boolean;
}

export interface UserOverviewAssignedCourse {
  id: string;
  title: string;
  courseType: string;
  lifecycleStatus: string;
  accessMode: string;
  roles: Array<'created' | 'primary_lecturer' | 'assistant_lecturer'>;
}

export interface UserOverviewSupervisedGroup {
  id: string;
  name: string;
  groupType: string;
  isArchived: boolean;
  assignmentRoles: string[];
  supervisionCount: number;
  cyclesCount: number;
  cycles: Array<{
    cycleCode: string;
    cycleNumber: number;
    cycleStatus: string;
    startDatetime: string | null;
    deadlineDatetime: string | null;
  }>;
}

export interface UserOverviewMemberGroup {
  id: string;
  name: string;
  groupType: string;
  isArchived: boolean;
  joinedAt: string | null;
  joinSource: string;
}

export interface UserOverviewData {
  enrolledCourses: UserOverviewEnrolledCourse[];
  assignedOrCreatedCourses: UserOverviewAssignedCourse[];
  supervisedGroups: UserOverviewSupervisedGroup[];
  memberGroups: UserOverviewMemberGroup[];
}

export interface PublicUserOverviewResponse {
  user: {
    id: string;
    name: string;
    initials: string;
    role: string;
    status: string;
    department: string;
    jobTitle: string;
    metroLine: string;
  };
  overview: UserOverviewData;
}

export interface UserProfileResponse {
  user: User & {
    status?: string;
    phoneE164?: string;
    gender?: 'male' | 'female';
    genderLabel?: string;
    nationalId?: string;
    dateOfBirth?: string | null;
    appointmentDate?: string | null;
    serviceEndDate?: string | null;
    address?: string;
    educationalQualification?: string;
    maritalStatus?: string;
    militaryServiceStatus?: string;
    metroLine?: string;
  };
  stats: {
    totalLearningHours: number;
    enrolledCoursesCount: number;
    completedCoursesCount: number;
  };
  overview?: UserOverviewData;
}

/**
 * User Profile & Member Overview API Service
 */
export const profileApi = {
  async getProfile(): Promise<UserProfileResponse> {
    return apiClient<UserProfileResponse>('/api/profile', {
      method: 'GET',
    });
  },

  async getPublicUserOverview(userId: string): Promise<PublicUserOverviewResponse> {
    return apiClient<PublicUserOverviewResponse>(`/api/users/${encodeURIComponent(userId)}/overview`, {
      method: 'GET',
    });
  },
};
