import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type { LoginCredentials, AuthResponse, User, UserRole } from './types';

function normalizeUserDto(raw: Record<string, unknown>): User {
  const fullName = String(raw.name ?? raw.fullName ?? '').trim();
  const rawRole = String(raw.role ?? 'user');
  const mappedRole = (rawRole === 'trainee' ? 'user' : rawRole) as UserRole;
  const initials =
    typeof raw.initials === 'string' && raw.initials.trim()
      ? raw.initials.trim()
      : fullName
        ? fullName.slice(0, 2)
        : 'م';
  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? raw.phoneE164 ?? ''),
    name: fullName || String(raw.phoneE164 ?? ''),
    role: mappedRole,
    department: String(raw.department ?? ''),
    jobTitle: String(raw.jobTitle ?? ''),
    initials,
  };
}

/**
 * Core Authentication Transport API
 */
export const authApi = {
  /**
   * Ensures Django csrftoken cookie is present before POST /api/auth/login
   */
  async ensureCsrf(options?: RequestOptions): Promise<void> {
    if (typeof document !== 'undefined' && /(?:^|;\s*)csrftoken=([^;]+)/.test(document.cookie)) {
      return;
    }
    await apiClient<{ csrfReady: boolean }>('/api/auth/csrf', {
      method: 'GET',
      ...options,
    });
  },

  /**
   * Performs user login
   */
  async login(credentials: LoginCredentials, options?: RequestOptions): Promise<AuthResponse> {
    await authApi.ensureCsrf(options);
    const res = await apiClient<AuthResponse & { user: Record<string, unknown> }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      ...options,
    });
    return {
      ...res,
      user: res.user ? normalizeUserDto(res.user) : (res.user as unknown as User),
    };
  },

  /**
   * Performs user logout
   */
  async logout(options?: RequestOptions): Promise<{ success: boolean; message: string }> {
    await authApi.ensureCsrf(options);
    return apiClient<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
      ...options,
    });
  },

  /**
   * Fetches the currently authenticated user profile
   */
  async getCurrentUser(options?: RequestOptions): Promise<{ user: User }> {
    const res = await apiClient<{ user: Record<string, unknown> }>('/api/auth/me', {
      method: 'GET',
      ...options,
    });
    return {
      user: res.user ? normalizeUserDto(res.user) : (res.user as unknown as User),
    };
  },
};
