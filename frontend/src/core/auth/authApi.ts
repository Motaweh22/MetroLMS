import { apiClient } from '@/core/api/apiClient';
import type { LoginCredentials, AuthResponse, User } from './types';

/**
 * Core Authentication Transport API
 *
 * BACKEND INTEGRATION NOTE:
 * When connecting to the future production backend:
 * 1. Update the endpoint paths if different (e.g. `/v1/auth/login`).
 * 2. Adapt request/response payloads if necessary.
 * All UI components consume this service via `useAuth()`, so changes
 * remain isolated to this module.
 */
export const authApi = {
  /**
   * Performs user login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Performs user logout
   */
  async logout(): Promise<{ success: boolean; message: string }> {
    return apiClient<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Fetches the currently authenticated user profile
   */
  async getCurrentUser(): Promise<{ user: User }> {
    return apiClient<{ user: User }>('/api/auth/me', {
      method: 'GET',
    });
  },
};
