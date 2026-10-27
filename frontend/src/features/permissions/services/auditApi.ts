import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  SystemAuditLogEntryDTO,
  AuditFilterParams,
  AuditLogResponseDTO,
} from '@/core/permissions/types';

/**
 * Centrally Managed System Security Audit Trail API Service (Increment 11 Phase 4D)
 */
export const auditApi = {
  /**
   * Fetches paginated and filtered security audit logs
   */
  async getAuditLogs(
    params?: AuditFilterParams,
    options?: RequestOptions
  ): Promise<AuditLogResponseDTO> {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.search && params.search.trim()) {
        searchParams.set('search', params.search.trim());
      }
      if (params.action && params.action.trim()) {
        searchParams.set('action', params.action.trim());
      }
      if (params.outcome && params.outcome !== 'all') {
        searchParams.set('outcome', params.outcome);
      }
      if (params.severity && params.severity !== 'all') {
        searchParams.set('severity', params.severity);
      }
      if (params.actorId && params.actorId.trim()) {
        searchParams.set('actorId', params.actorId.trim());
      }
      if (params.startDate) {
        searchParams.set('startDate', params.startDate);
      }
      if (params.endDate) {
        searchParams.set('endDate', params.endDate);
      }
      if (params.page !== undefined) {
        searchParams.set('page', String(params.page));
      }
      if (params.pageSize !== undefined) {
        searchParams.set('pageSize', String(params.pageSize));
      }
    }

    const query = searchParams.toString();
    const endpoint = query ? `/api/admin/audit?${query}` : '/api/admin/audit';
    return apiClient<AuditLogResponseDTO>(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Fetches a single audit log entry by ID
   */
  async getAuditLogById(
    id: string,
    options?: RequestOptions
  ): Promise<SystemAuditLogEntryDTO> {
    return apiClient<SystemAuditLogEntryDTO>(`/api/admin/audit/${encodeURIComponent(id)}`, {
      method: 'GET',
      ...options,
    });
  },
};
