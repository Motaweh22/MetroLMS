import { apiClient } from '@/core/api/apiClient';
import type { DashboardData } from '@/core/dashboard/types';

/**
 * Dashboard API Service
 *
 * Fetches role-adaptive operational dashboard data.
 */
export const dashboardApi = {
  async getDashboardData(): Promise<DashboardData> {
    return apiClient<DashboardData>('/api/dashboard', {
      method: 'GET',
    });
  },
};
