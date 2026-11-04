/**
 * Core Authentication & Identity Types
 *
 * NOTE: Mock authentication is for frontend development only.
 * It is not real identity verification or a security boundary.
 */

export type UserRole =
  | 'developer'
  | 'super_admin'
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

/**
 * Memory-only continuity proof established during current AuthProvider lifecycle (Increment 5.4 / WP-5.4.1).
 * STRICT SECURITY REQUIREMENT:
 * Exists ONLY in memory; NEVER serialized to sessionStorage or localStorage.
 * Contains strictly non-sensitive identity metadata and SHA-256 snapshot digest; NO raw tokens or credentials.
 */
export interface EmergencyContinuityProof {
  personaId: string;
  provenAt: number;
  tokenTimestamp: number;
  /** Non-reversible SHA-256 digest of the exact Developer origin snapshot from which continuity was proven */
  originSnapshotFingerprint: string;
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
  /** Whether an isolated test session is currently active (Increment 5.3 / Decision D-10) */
  isIsolatedSession: boolean;
  /** The currently active synthetic test persona, or null if in normal Developer session */
  isolatedPersona: import('./testPersonas').SyntheticTestPersona | null;
  /** Launches a controlled isolated test session for an allowlisted synthetic persona */
  launchIsolatedTestSession: (personaId: string) => Promise<boolean>;
  /** Returns to the exact Developer origin session in a single transaction */
  returnToDeveloperSession: () => Promise<boolean>;
  /** Re-triggers session revalidation following a temporary network failure (Increment 5.4 / WP-5.4.1) */
  retryRevalidation?: () => Promise<void>;
  /** Whether the system is in an unauthenticated emergency state with valid memory-only continuity proof */
  isEmergencyState?: boolean;
  /** Memory-only emergency continuity proof for the current AuthProvider lifecycle */
  emergencyProof?: EmergencyContinuityProof | null;
}
