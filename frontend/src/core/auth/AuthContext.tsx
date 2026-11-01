import React, { useState, useEffect, useCallback } from 'react';
import type { User, LoginCredentials, UserRole, AuthContextValue } from './types';
import { AuthContext } from './context';
import { authStorage } from './authStorage';
import { authApi } from './authApi';
import { SYNTHETIC_DEMO_ACCOUNTS } from './demoAccounts';
import { sanitizeErrorMessage, ApiError } from '@/core/api/apiClient';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSession = authStorage.getSession();
  const hasInitialToken = Boolean(
    initialSession?.token &&
    (!initialSession.expiresAt || Date.now() <= initialSession.expiresAt)
  );

  // MFR-20: Gated session state — do NOT expose unvalidated stored user as authenticated
  // before successful server revalidation. Protected content remains inaccessible.
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(hasInitialToken);
  const [error, setError] = useState<string | null>(null);

  // Revalidate stored authenticated session on mount (Phase 1 MFR-20)
  useEffect(() => {
    let isCancelled = false;

    async function revalidateSession() {
      const session = authStorage.getSession();

      if (!session?.token) {
        if (!isCancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      // 1. Client-side expiration check
      if (session.expiresAt && Date.now() > session.expiresAt) {
        authStorage.clearSession();
        if (!isCancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      const requestToken = session.token;

      // 2. Server/API revalidation via GET /api/auth/me
      try {
        const response = await authApi.getCurrentUser();

        if (isCancelled) return;

        // Race Condition Protection: Verify that currently stored token is STILL the exact
        // token associated with this in-flight request. An outdated response must NEVER
        // overwrite a newer login session or restore a previously logged-out account.
        const currentSession = authStorage.getSession();
        if (currentSession && currentSession.token === requestToken) {
          setUser(response.user);
          // Sync authoritative user data back to session storage
          authStorage.setSession({
            ...currentSession,
            user: response.user,
          });
          setError(null);
        }
      } catch (err: unknown) {
        if (isCancelled) return;

        const currentSession = authStorage.getSession();
        if (currentSession && currentSession.token === requestToken) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
            // Authoritative session invalidation (401 Unauthorized, 403 Forbidden, 404 Not Found)
            authStorage.clearSession();
            setUser(null);
            setError(err.message || 'انتهت صلاحية الجلسة أو تم تعليق الحساب.');
          } else {
            // Temporary network failure or transient server error:
            // Do NOT automatically destroy stored credentials in storage,
            // but do NOT silently treat the unverified cached session as authenticated either!
            setUser(null);
            setError('تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال. يرجى إعادة المحاولة.');
          }
        }
      } finally {
        if (!isCancelled) {
          const currentSession = authStorage.getSession();
          if (!currentSession || currentSession.token === requestToken) {
            setIsLoading(false);
          }
        }
      }
    }

    revalidateSession();

    return () => {
      isCancelled = true;
    };
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
