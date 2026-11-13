/**
 * Authentication API Service (Canonical Re-export)
 *
 * Re-exports the canonical implementation from `@/core/auth/authApi` to eliminate
 * duplicate code and prevent contract drift while preserving existing import paths.
 */
export { authApi } from '@/core/auth/authApi';
