import { apiClient } from '@/core/api/apiClient';
import type { User } from '@/core/auth/types';

export interface UserProfileResponse {
  user: User & {
    status?: string;
    phoneE164?: string;
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
}

/**
 * User Profile API Service
 */
export const profileApi = {
  async getProfile(): Promise<UserProfileResponse> {
    return apiClient<UserProfileResponse>('/api/profile', {
      method: 'GET',
    });
  },
};
