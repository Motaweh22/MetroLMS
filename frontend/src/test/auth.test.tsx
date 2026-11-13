import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider, useAuth } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPreviewPage } from '@/pages/DashboardPreviewPage';
import { DesignSystemPreviewPage } from '@/pages/DesignSystemPreviewPage';
import { AppLayout } from '@/app/layouts/AppLayout';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { getCurrentSessionEpoch, advanceSessionEpoch } from '@/core/auth/sessionEpoch';
import { authApi } from '@/core/auth/authApi';
import type { User } from '@/core/auth/types';

// Establish MSW mock server for tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
  authStorage.clearLogoutStatus();
  authStorage.clearDeveloperOriginSession();
});
afterAll(() => server.close());

describe('Increment 3: Login Interface & Mock Sessions Verification', () => {
  describe('LoginForm & Validation', () => {
    it('renders email, password inputs, submit button, and demo accounts', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByLabelText(/البريد الإلكتروني الوظيفي/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i })).toBeInTheDocument();
      expect(screen.getByText(/حسابات العرض التجريبي السريع/i)).toBeInTheDocument();
    });

    it('validates required fields when submitted empty', async () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/يرجى إدخال البريد الإلكتروني الوظيفي/i)).toBeInTheDocument();
        expect(screen.getByText(/يرجى إدخال كلمة المرور/i)).toBeInTheDocument();
      });
    });

    it('toggles password visibility between password and text type', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByLabelText(/إظهار كلمة المرور/i);
      fireEvent.click(toggleBtn);

      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(/إخفاء كلمة المرور/i)).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/إخفاء كلمة المرور/i));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('populates credentials when clicking a demo account picker item', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/البريد الإلكتروني الوظيفي/i);
      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });

      // Find the "admin" demo account card button
      const adminButtons = screen.getAllByRole('button', { name: /استخدام الحساب/i });
      fireEvent.click(adminButtons[0]);

      expect(emailInput).toHaveValue(SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.email);
      expect(passwordInput).toHaveValue(SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.password);
    });
  });

  describe('Authentication Flow & MSW Interception', () => {
    it('successfully logs in with valid synthetic credentials and stores session', async () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/البريد الإلكتروني الوظيفي/i);
      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });

      fireEvent.change(emailInput, {
        target: { value: SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.email },
      });
      fireEvent.change(passwordInput, {
        target: { value: SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.password },
      });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        const session = authStorage.getSession();
        expect(session).not.toBeNull();
        expect(session?.user.email).toBe(SYNTHETIC_DEMO_ACCOUNTS.admin.user.email);
        expect(session?.user.role).toBe('admin');
        expect(session?.token).toContain('mock_jwt_');
      });
    });

    it('displays error alert on invalid credentials', async () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/البريد الإلكتروني الوظيفي/i);
      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@cairo-metro.com' } });
      fireEvent.change(passwordInput, { target: { value: 'badPassword123' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
          screen.getByText(/البريد الإلكتروني أو كلمة المرور غير صحيحة/i)
        ).toBeInTheDocument();
      });

      // Assert zero session was stored
      expect(authStorage.getSession()).toBeNull();
    });
  });

  describe('Session Storage Lifecycle & Plaintext Password Protection', () => {
    it('restores session from authStorage on initial load without re-entering password', async () => {
      const mockSession = {
        user: SYNTHETIC_DEMO_ACCOUNTS.lecturer.user,
        token: 'mock_jwt_test_restore',
        expiresAt: Date.now() + 100000,
      };
      authStorage.setSession(mockSession);

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="dashboard" element={<DashboardPreviewPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Verify navbar reflects restored lecturer user
      await waitFor(() => {
        expect(screen.getAllByText(SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.name).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/محاضر معتمد/i).length).toBeGreaterThan(0);
      });

      // Verify storage contains no password property
      const rawStored = window.sessionStorage.getItem('metro_lms_auth_session');
      expect(rawStored).not.toContain('metroTrainer2026!');
      expect(rawStored).not.toContain('password');
    });

    it('clears session on logout', async () => {
      const mockSession = {
        user: SYNTHETIC_DEMO_ACCOUNTS.admin.user,
        token: 'mock_jwt_test_logout',
        expiresAt: Date.now() + 100000,
      };
      authStorage.setSession(mockSession);

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route path="dashboard" element={<DashboardPreviewPage />} />
              </Route>
              <Route path="login" element={<div>صفحة الدخول</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Click logout in navbar
      await waitFor(() => {
        expect(screen.getByLabelText(/تسجيل الخروج من المنظومة/i)).toBeInTheDocument();
      });
      const logoutBtn = screen.getByLabelText(/تسجيل الخروج من المنظومة/i);
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(authStorage.getSession()).toBeNull();
      });
    });
  });

  describe('Routing Protection & Guarding', () => {
    it('redirects unauthenticated users from protected /dashboard to /login', async () => {
      function LocationEcho() {
        const location = useLocation();
        return (
          <div data-testid="location-from">
            {(location.state as { from?: { pathname?: string } })?.from?.pathname}
          </div>
        );
      }

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>لوحة التحكم المحمية</div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/login"
                element={
                  <div>
                    <span>صفحة الدخول للمنظومة</span>
                    <LocationEcho />
                  </div>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Must be redirected to /login
      expect(screen.getByText('صفحة الدخول للمنظومة')).toBeInTheDocument();
      expect(screen.queryByText('لوحة التحكم المحمية')).not.toBeInTheDocument();

      // Requested route preserved in state.from
      expect(screen.getByTestId('location-from')).toHaveTextContent('/dashboard');
    });

    it('allows public access to /design-system without authentication', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/design-system']}>
            <Routes>
              <Route path="/design-system" element={<DesignSystemPreviewPage />} />
              <Route path="/login" element={<div>صفحة الدخول</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(
        screen.getByText(/المعمل البصري الموحد لمكونات الواجهة الأمامية/i)
      ).toBeInTheDocument();
      expect(screen.queryByText('صفحة الدخول')).not.toBeInTheDocument();
    });

    it('redirects authenticated users away from /login to /dashboard', async () => {
      const mockSession = {
        user: SYNTHETIC_DEMO_ACCOUNTS.trainee.user,
        token: 'mock_jwt_authed_login',
        expiresAt: Date.now() + 100000,
      };
      authStorage.setSession(mockSession);

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<div>لوحة التحكم الرئيسية</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('لوحة التحكم الرئيسية')).toBeInTheDocument();
      });
    });
  });

  describe('D-AUTH-01 Production Cookie-First Bootstrap & Session Lifecycle', () => {
    function AuthContextConsumer({ onState }: { onState: (auth: ReturnType<typeof useAuth>) => void }) {
      const auth = useAuth();
      onState(auth);
      return (
        <div data-testid="auth-consumer">
          <span data-testid="auth-user-id">{auth.user ? auth.user.id : 'NONE'}</span>
          <span data-testid="auth-is-loading">{auth.isLoading ? 'LOADING' : 'READY'}</span>
          <span data-testid="auth-logout-status">{auth.logoutStatus || 'NULL'}</span>
          {auth.error && <span data-testid="auth-error-msg">{auth.error}</span>}
          <button data-testid="btn-retry-logout" onClick={() => auth.retryLogout()}>Retry Logout</button>
          <button data-testid="btn-retry-revalidate" onClick={() => auth.retryRevalidation()}>Retry Revalidate</button>
        </div>
      );
    }

    it('production cold start without local token issues GET /api/auth/me and hydrates user on HTTP 200', async () => {
      authStorage.clearSession();
      const mockProdUser: User = {
        id: 'USR_PROD_ADM_001',
        name: 'مدير المنظومة الميداني',
        email: 'prod.admin@cairo-metro.internal',
        role: 'admin',
        department: 'Operations',
        jobTitle: 'Field Administrator',
        initials: 'م.م',
      };

      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ user: mockProdUser });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.user?.id).toBe('USR_PROD_ADM_001');
      expect(capturedAuth?.user?.role).toBe('admin');
      expect(capturedAuth?.isAuthenticated).toBe(true);
      expect(capturedAuth?.error).toBeNull();
    });

    it('guest cold-start 401 cleans unauthenticated guest state, does NOT advance epoch, and shows no error banner', async () => {
      authStorage.clearSession();
      const initialEpoch = getCurrentSessionEpoch();

      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ message: 'Unauthenticated' }, { status: 401 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.isAuthenticated).toBe(false);
      expect(capturedAuth?.error).toBeNull();
      // Cold-start 401 for an unauthenticated guest must not advance the session epoch
      expect(getCurrentSessionEpoch()).toBe(initialEpoch);
    });

    it('rejects malformed user payload and throws error without establishing authenticated state', async () => {
      authStorage.clearSession();

      server.use(
        http.post('/api/auth/login', () => {
          // Missing user id or non-object user
          return HttpResponse.json({ user: {} });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      await expect(
        capturedAuth.login({ email: 'test@example.com', password: 'secretPassword123' })
      ).rejects.toThrow('استجابة غير صالحة من خادم المصادقة: تعذر التحقق من بيانات المستخدم.');

      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.isAuthenticated).toBe(false);
    });

    it('S5 transient network failure preserves browser session, sets user to null, and displays Arabic retry message without advancing epoch', async () => {
      authStorage.clearSession();
      const initialEpoch = getCurrentSessionEpoch();

      server.use(
        http.get('/api/auth/me', () => {
          return new HttpResponse(null, { status: 500 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.isAuthenticated).toBe(false);
      expect(capturedAuth?.error).toContain('تعذر التحقق من صلاحية الجلسة بسبب مشكلة في الاتصال بالخادم');
      // S5 transient transport failure must NOT advance session epoch
      expect(getCurrentSessionEpoch()).toBe(initialEpoch);
    });

    it('preserves authenticatedSessionEpochRef during S5, allowing subsequent authoritative 401 to advance epoch', async () => {
      const initialUser: User = {
        id: 'USR_ACTIVE_DEV_001',
        name: 'Active Developer',
        email: 'dev@cairo-metro.internal',
        role: 'developer',
      };

      // 1. Initially authenticated
      let meHandlerStatus = 200;
      server.use(
        http.get('/api/auth/me', () => {
          if (meHandlerStatus === 200) {
            return HttpResponse.json({ user: initialUser });
          } else if (meHandlerStatus === 500) {
            return new HttpResponse(null, { status: 500 });
          } else {
            return HttpResponse.json({ message: 'Session expired' }, { status: 401 });
          }
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.user?.id).toBe('USR_ACTIVE_DEV_001');
      });

      const epochAtLogin = getCurrentSessionEpoch();

      // 2. Encounter transient S5 failure
      meHandlerStatus = 500;
      await act(async () => {
        await capturedAuth.retryRevalidation();
      });

      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.error).toContain('تعذر التحقق من صلاحية الجلسة');
      // Epoch must not advance on transient S5
      expect(getCurrentSessionEpoch()).toBe(epochAtLogin);

      // 3. Now server authoritatively rejects session with 401
      meHandlerStatus = 401;
      await act(async () => {
        await capturedAuth.retryRevalidation();
      });

      // Because authenticatedSessionEpochRef was preserved across S5,
      // the authoritative 401 recognizes this was an authenticated session and advances epoch!
      expect(getCurrentSessionEpoch()).toBeGreaterThan(epochAtLogin);
      expect(capturedAuth?.user).toBeNull();
    });

    it('S5 recovery: calling retryRevalidation() recovers session when server returns HTTP 200', async () => {
      let isServerHealthy = false;
      const recoveredUser: User = {
        id: 'USR_RECOVERED_001',
        name: 'Recovered Trainee',
        email: 'trainee@cairo-metro.internal',
        role: 'user',
      };

      server.use(
        http.get('/api/auth/me', () => {
          if (!isServerHealthy) {
            return new HttpResponse(null, { status: 503 });
          }
          return HttpResponse.json({ user: recoveredUser });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });
      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.error).toContain('تعذر التحقق من صلاحية الجلسة');

      // Server recovers
      isServerHealthy = true;
      await act(async () => {
        await capturedAuth.retryRevalidation();
      });

      expect(capturedAuth?.user?.id).toBe('USR_RECOVERED_001');
      expect(capturedAuth?.error).toBeNull();
    });

    it('authoritative 403 (suspended) or 404 (deleted) invalidates active session and surfaces specific Arabic message', async () => {
      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json(
            { message: 'تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.' },
            { status: 403 }
          );
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.error).toBe('تم إيقاف هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.');
    });
  });

  describe('LoginForm Submission State Isolation & onSuccess Contract', () => {
    it('initial state renders interactive submit button without false loading spinner', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });
      expect(submitBtn).toBeInTheDocument();
      expect(submitBtn).toBeEnabled();
      expect(screen.queryByText(/جارٍ تسجيل الدخول/i)).not.toBeInTheDocument();
    });

    it('submission sets local isSubmitting, displays loading spinner, and finally resets isSubmitting', async () => {
      let resolveLogin: (res: any) => void;
      const slowLoginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      server.use(
        http.post('/api/auth/login', async () => {
          await slowLoginPromise;
          return HttpResponse.json({
            user: SYNTHETIC_DEMO_ACCOUNTS.admin.user,
            token: 'mock_jwt_USR_ADMIN_001_1730000000000',
            expiresAt: Date.now() + 3600000,
          });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/البريد الإلكتروني الوظيفي/i);
      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });

      fireEvent.change(emailInput, { target: { value: SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.email } });
      fireEvent.change(passwordInput, { target: { value: SYNTHETIC_DEMO_ACCOUNTS.admin.credentials.password } });

      fireEvent.click(submitBtn);

      // During active in-flight submission: button must reflect isSubmitting
      await waitFor(() => {
        expect(screen.getByText(/جارٍ تسجيل الدخول/i)).toBeInTheDocument();
        expect(submitBtn).toBeDisabled();
      });

      // Complete server response
      await act(async () => {
        resolveLogin!({ ok: true });
      });

      // After submission completes: button is re-enabled and restored
      await waitFor(() => {
        expect(screen.queryByText(/جارٍ تسجيل الدخول/i)).not.toBeInTheDocument();
      });
    });

    it('onSuccess callback executes only after an accepted login, and is never called on failure', async () => {
      const onSuccessSpy = vi.fn();

      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm onSuccess={onSuccessSpy} />
          </MemoryRouter>
        </AuthProvider>
      );

      const emailInput = screen.getByLabelText(/البريد الإلكتروني الوظيفي/i);
      const passwordInput = screen.getByLabelText(/^كلمة المرور/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /تسجيل الدخول إلى المنظومة/i });

      fireEvent.change(emailInput, { target: { value: 'bad@cairo-metro.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongPass' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // onSuccess must NOT have been called on failed login
      expect(onSuccessSpy).not.toHaveBeenCalled();
    });

    it('stale successful login throws StaleEpochError and does NOT mutate React user state', async () => {
      let resolveSlowLogin: (res: any) => void;
      const slowLoginPromise = new Promise((resolve) => {
        resolveSlowLogin = resolve;
      });

      server.use(
        http.post('/api/auth/login', async () => {
          await slowLoginPromise;
          return HttpResponse.json({
            user: { id: 'USR_STALE_USER', name: 'Stale User', role: 'user' },
            token: 'mock_jwt_USR_STALE_USER_1730000000000',
            expiresAt: Date.now() + 3600000,
          });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      // 1. Dispatch slow login operation
      const inFlightLogin = capturedAuth.login({ email: 'stale@metro.com', password: 'password123' });

      // 2. Intervening session transition occurs before login finishes (e.g. advanceSessionEpoch)
      advanceSessionEpoch();

      // 3. Resolve the delayed network response
      resolveSlowLogin!({ ok: true });

      // 4. Stale login rejects through StaleEpochError
      await expect(inFlightLogin).rejects.toThrow();

      // User state must NOT be mutated to the stale user
      expect(capturedAuth?.user).toBeNull();
    });
  });

  describe('D-AUTH-01 Logout State Machine & LOGOUT_UNCONFIRMED Barrier', () => {
    it('synchronous local identity termination at logout initiation', async () => {
      server.use(
        http.post('/api/auth/logout', () => {
          return new Promise(() => {}); // Intentionally never resolve
        })
      );

      const initialEpoch = getCurrentSessionEpoch();
      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      // Calling logout synchronously advances session epoch before awaiting network
      capturedAuth.logout();

      expect(getCurrentSessionEpoch()).toBeGreaterThan(initialEpoch);
      expect(capturedAuth?.user).toBeNull();
    });

    it('confirmed logout on HTTP 200 or 204 sets LOGOUT_CONFIRMED and clears error', async () => {
      server.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ success: true, message: 'Logged out' }, { status: 200 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      await act(async () => {
        await capturedAuth.logout();
      });

      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_CONFIRMED');
      expect(authStorage.getLogoutStatus()).toBe('LOGOUT_CONFIRMED');
      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.error).toBeNull();
    });

    it('server failure or CSRF rejection enters LOGOUT_UNCONFIRMED with retry message', async () => {
      server.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ detail: 'CSRF Failed' }, { status: 403 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      await act(async () => {
        await capturedAuth.logout();
      });

      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_UNCONFIRMED');
      expect(authStorage.getLogoutStatus()).toBe('LOGOUT_UNCONFIRMED');
      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.error).toContain('فشل التحقق الأمني (CSRF) عند تسجيل الخروج');
    });

    it('HTTP 401 on POST /api/auth/logout is NOT treated as confirmed and enters LOGOUT_UNCONFIRMED', async () => {
      server.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      await act(async () => {
        await capturedAuth.logout();
      });

      // Defect 1 fix: 401 on logout view indicates authentication rejection before view execution;
      // it must NOT be treated as server confirmation.
      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_UNCONFIRMED');
      expect(authStorage.getLogoutStatus()).toBe('LOGOUT_UNCONFIRMED');
    });

    it('LoginForm renders persistent warning alert with retry button when LOGOUT_UNCONFIRMED', () => {
      authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');

      render(
        <AuthProvider>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/تعذر تأكيد إنهاء الجلسة على الخادم/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /إعادة محاولة إنهاء الجلسة/i })).toBeInTheDocument();
    });

    it('prohibition on silent restoration: GET /api/auth/me 200 blocks user hydration while LOGOUT_UNCONFIRMED is active', async () => {
      authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');
      const latentUser: User = {
        id: 'USR_LATENT_001',
        name: 'Latent User',
        email: 'latent@metro.internal',
        role: 'user',
      };

      let reconciliationLogoutCalled = false;
      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ user: latentUser });
        }),
        http.post('/api/auth/logout', () => {
          reconciliationLogoutCalled = true;
          return HttpResponse.json({ success: true });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      // CRITICAL GUARANTEE: User must NOT be logged in silently
      expect(capturedAuth?.user).toBeNull();
      expect(capturedAuth?.isAuthenticated).toBe(false);
      // Automatic reconciliation logout was dispatched
      expect(reconciliationLogoutCalled).toBe(true);
    });

    it('GET /api/auth/me 401 does NOT clear LOGOUT_UNCONFIRMED', async () => {
      authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');

      server.use(
        http.get('/api/auth/me', () => {
          return HttpResponse.json({ message: 'Unauthenticated' }, { status: 401 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      // Defect 2 fix: 401 on /api/auth/me does not prove server-side session eviction;
      // unconfirmed status must be retained
      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_UNCONFIRMED');
      expect(authStorage.getLogoutStatus()).toBe('LOGOUT_UNCONFIRMED');
      expect(capturedAuth?.error).toContain('تعذر تأكيد إنهاء الجلسة على الخادم');
    });

    it('successful retryLogout clears unconfirmed state and transitions to LOGOUT_CONFIRMED', async () => {
      authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');

      server.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ success: true, message: 'Cleaned' }, { status: 200 });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_UNCONFIRMED');

      await act(async () => {
        await capturedAuth.retryLogout();
      });

      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_CONFIRMED');
      expect(authStorage.getLogoutStatus()).toBe('LOGOUT_CONFIRMED');
      expect(capturedAuth?.error).toBeNull();
    });

    it('successful intentional login clears LOGOUT_UNCONFIRMED to null', async () => {
      authStorage.setLogoutStatus('LOGOUT_UNCONFIRMED');

      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json({
            user: SYNTHETIC_DEMO_ACCOUNTS.trainee.user,
            token: 'mock_jwt_USR_TRN_001_1730000000000',
            expiresAt: Date.now() + 3600000,
          });
        })
      );

      let capturedAuth: any = null;
      render(
        <AuthProvider>
          <AuthContextConsumer onState={(auth) => (capturedAuth = auth)} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(capturedAuth?.isLoading).toBe(false);
      });

      expect(capturedAuth?.logoutStatus).toBe('LOGOUT_UNCONFIRMED');

      await act(async () => {
        await capturedAuth.login(SYNTHETIC_DEMO_ACCOUNTS.trainee.credentials);
      });

      expect(capturedAuth?.user?.id).toBe(SYNTHETIC_DEMO_ACCOUNTS.trainee.user.id);
      expect(capturedAuth?.logoutStatus).toBeNull();
      expect(authStorage.getLogoutStatus()).toBeNull();
    });
  });
});
