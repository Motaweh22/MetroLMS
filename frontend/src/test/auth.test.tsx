import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { server } from '@/mocks/server';
import { authStorage } from '@/core/auth/authStorage';
import { AuthProvider } from '@/core/auth/AuthContext';
import { ProtectedRoute } from '@/core/auth/ProtectedRoute';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPreviewPage } from '@/pages/DashboardPreviewPage';
import { DesignSystemPreviewPage } from '@/pages/DesignSystemPreviewPage';
import { AppLayout } from '@/app/layouts/AppLayout';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';

// Establish MSW mock server for tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
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
    it('restores session from authStorage on initial load without re-entering password', () => {
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
      expect(screen.getAllByText(SYNTHETIC_DEMO_ACCOUNTS.lecturer.user.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/محاضر معتمد/i).length).toBeGreaterThan(0);

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
});
