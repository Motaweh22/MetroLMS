/**
 * Core Authentication & Identity Types
 *
 * NOTE: Mock authentication is for frontend development only.
 * It is not real identity verification or a security boundary.
 */

export type UserRole =
  | 'admin'
  | 'assistant_admin'
  | 'lecturer'
  | 'user';

/** Compatibility alias for trainee */
export type TraineeRole = 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  jobTitle: string;
  initials: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: number;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoUser: (role: UserRole) => Promise<void>;
  clearError: () => void;
}
