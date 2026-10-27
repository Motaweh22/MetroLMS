import { useContext } from 'react';
import { AuthContext } from './context';
import { authStorage } from './authStorage';
import type { AuthContextValue } from './types';

/**
 * Access the core authentication context.
 * Gracefully falls back to authStorage session if called outside of AuthProvider in tests.
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    const session = authStorage.getSession();
    return {
      user: session?.user || null,
      isAuthenticated: !!session?.user,
      isLoading: false,
      error: null,
      login: async () => {},
      logout: async () => {},
      switchDemoUser: async () => {},
      clearError: () => {},
    };
  }
  return context;
}

export default useAuthContext;
