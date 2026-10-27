import { useAuthContext } from '@/core/auth/useAuthContext';

/**
 * Custom hook to access authentication state and operations
 */
export function useAuth() {
  return useAuthContext();
}

export default useAuth;
