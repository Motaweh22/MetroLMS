import React, { useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, UserRole, AuthContextValue } from './types';
import { AuthContext } from './context';
import { authStorage } from './authStorage';
import { authApi } from './authApi';
import { SYNTHETIC_DEMO_ACCOUNTS } from './demoAccounts';
import { sanitizeErrorMessage } from '@/core/api/apiClient';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount from authStorage
  useEffect(() => {
    const session = authStorage.getSession();
    if (session?.user) {
      setUser(session.user);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.login(credentials);
      const session = {
        user: response.user,
        token: response.token,
        expiresAt: response.expiresAt,
      };

      authStorage.setSession(session);
      setUser(response.user);
    } catch (err: unknown) {
      const fallbackMsg = 'فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.';
      const rawMsg = err instanceof Error ? err.message : fallbackMsg;
      setError(sanitizeErrorMessage(rawMsg, fallbackMsg));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout().catch(() => {});
    } finally {
      authStorage.clearSession();
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const switchDemoUser = useCallback(async (role: UserRole): Promise<void> => {
    const accountKey = role === 'user' ? 'trainee' : role;
    const account = SYNTHETIC_DEMO_ACCOUNTS[accountKey];
    if (!account) return;

    await login(account.credentials);
  }, [login]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
    switchDemoUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
