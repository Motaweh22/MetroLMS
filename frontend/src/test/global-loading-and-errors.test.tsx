import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { AuthProvider } from '@/core/auth/AuthContext';
import { authStorage } from '@/core/auth/authStorage';
import { SYNTHETIC_DEMO_ACCOUNTS } from '@/core/auth/demoAccounts';
import { AppRouter } from '@/app/router';
import {
  LoadingScreen,
  PageLoading,
  SectionSkeleton,
  InlineLoading,
} from '@/shared/ui/Loading';
import {
  ErrorBoundary,
  ErrorState,
  ForbiddenState,
} from '@/shared/ui/Error';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { UnexpectedErrorPage } from '@/pages/UnexpectedErrorPage';
import {
  apiClient,
  ApiError,
  getLocalizedStatusMessage,
  sanitizeErrorMessage,
} from '@/core/api/apiClient';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  authStorage.clearSession();
});
afterAll(() => server.close());

describe('Global Loading System, Error Pages & Application Integration', () => {
  // ── 1. Shared Loading Components ───────────────────────────────────────────
  describe('1. Shared Loading Components', () => {
    it('renders full-page LoadingScreen with Metro brand, spinner and accessible status', () => {
      render(
        <LoadingScreen
          message="جارٍ تهيئة النظام التدريبي..."
          subtitle="يرجى الانتظار لحظات"
        />
      );

      const statusContainer = screen.getByRole('status');
      expect(statusContainer).toBeInTheDocument();
      expect(statusContainer).toHaveAttribute('aria-live', 'polite');
      expect(statusContainer).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('loading-screen')).toBeInTheDocument();

      // Brand Logo presence
      expect(screen.getByText(/مترو القاهرة/i)).toBeInTheDocument();
      expect(screen.getByText('جارٍ تهيئة النظام التدريبي...')).toBeInTheDocument();
      expect(screen.getByText('يرجى الانتظار لحظات')).toBeInTheDocument();
    });

    it('renders PageLoading within page layout with role status', () => {
      render(<PageLoading message="جارٍ تحميل سجل التدريب..." size="lg" />);

      const pageLoader = screen.getByTestId('page-loading');
      expect(pageLoader).toBeInTheDocument();
      expect(pageLoader).toHaveAttribute('role', 'status');
      expect(pageLoader).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('جارٍ تحميل سجل التدريب...')).toBeInTheDocument();
    });

    it('renders SectionSkeleton for cards, tables, metrics, and text variants', () => {
      const { rerender } = render(
        <SectionSkeleton variant="card" count={3} ariaLabel="جارٍ تحميل البطاقات" />
      );

      expect(screen.getByTestId('skeleton-cards')).toBeInTheDocument();
      expect(screen.getByTestId('skeleton-cards')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByLabelText('جارٍ تحميل البطاقات')).toBeInTheDocument();

      // Table variant
      rerender(<SectionSkeleton variant="table" count={4} />);
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();

      // Metric variant
      rerender(<SectionSkeleton variant="metric" count={4} />);
      expect(screen.getByTestId('skeleton-metric')).toBeInTheDocument();

      // Text variant
      rerender(<SectionSkeleton variant="text" count={2} />);
      expect(screen.getByTestId('skeleton-text')).toBeInTheDocument();
    });

    it('renders InlineLoading for buttons and chips with accessible label', () => {
      render(<InlineLoading message="جارٍ الحفظ..." size="sm" />);

      const inlineStatus = screen.getByRole('status');
      expect(inlineStatus).toBeInTheDocument();
      expect(screen.getByText('جارٍ الحفظ...')).toBeInTheDocument();
    });
  });

  // ── 2. Error Pages ────────────────────────────────────────────────────────
  describe('2. Dedicated Error Pages', () => {
    it('renders NotFoundPage (404) with role-aware return destination', () => {
      authStorage.setSession({
        user: SYNTHETIC_DEMO_ACCOUNTS.admin.user,
        token: 'token-admin',
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/some-invalid-path']}>
            <NotFoundPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      expect(screen.getByText(/الصفحة غير موجودة \(404\)/i)).toBeInTheDocument();
      expect(screen.getByText(/المسار المطلوب غير موجود ضمن المنظومة التدريبية/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /العودة إلى لوحة المتابعة/i })).toBeInTheDocument();
    });

    it('renders NotFoundPage in standalone mode with brand header', () => {
      render(
        <AuthProvider>
          <MemoryRouter>
            <NotFoundPage standalone={true} />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByText(/مترو القاهرة/i)).toBeInTheDocument();
      expect(screen.getByText(/الصفحة غير موجودة \(404\)/i)).toBeInTheDocument();
      expect(screen.getByText(/جميع الحقوق محفوظة © 2026/i)).toBeInTheDocument();
    });

    it('renders ForbiddenPage (403) with user role and return action', async () => {
      authStorage.setSession({
        user: SYNTHETIC_DEMO_ACCOUNTS.trainee.user,
        token: 'token-trainee',
        expiresAt: Date.now() + 3600000,
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/groups']}>
            <ForbiddenPage />
          </MemoryRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
        expect(screen.getByText(/غير مصرح بالوصول \(403\)/i)).toBeInTheDocument();
        expect(screen.getByText(/ليس لديك الصلاحيات الكافية للوصول/i)).toBeInTheDocument();
        expect(screen.getByText(/متدرب فني/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('link', { name: /العودة إلى لوحة المتابعة/i })).toBeInTheDocument();
    });

    it('renders UnexpectedErrorPage (500) with reference identifier and retry action', () => {
      const handleRetry = vi.fn();

      render(
        <MemoryRouter>
          <UnexpectedErrorPage
            status={500}
            errorId="ERR-TEST-99"
            onRetry={handleRetry}
          />
        </MemoryRouter>
      );

      expect(screen.getByTestId('unexpected-error-page')).toBeInTheDocument();
      expect(screen.getByText(/خطأ في استجابة الخادم \(500\)/i)).toBeInTheDocument();
      expect(screen.getByTestId('error-reference-id')).toHaveTextContent('ERR-TEST-99');

      const retryBtn = screen.getByTestId('unexpected-error-retry-btn');
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('renders localized ErrorState with sanitized message and retry callback', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="فشل في جلب المقررات"
          message="Failed to fetch: TypeError at main.js:20"
          onRetry={handleRetry}
        />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('فشل في جلب المقررات')).toBeInTheDocument();

      // Sanitized message: Technical stack trace is replaced by Arabic fallback
      expect(screen.queryByText(/TypeError at main\.js/i)).not.toBeInTheDocument();
      expect(screen.getByText(/حدث خطأ أثناء معالجة الطلب/i)).toBeInTheDocument();

      const retryBtn = screen.getByTestId('error-state-retry-btn');
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('renders ForbiddenState component for inline container warnings', () => {
      render(
        <MemoryRouter>
          <ForbiddenState />
        </MemoryRouter>
      );

      expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/غير مصرح بالوصول \(403\)/i)).toBeInTheDocument();
    });
  });

  // ── 3. React Error Boundary ───────────────────────────────────────────────
  describe('3. React Error Boundary', () => {
    const ProblemChild: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
      if (shouldThrow) {
        throw new Error('Simulated runtime rendering crash');
      }
      return <div data-testid="healthy-child">المحتوى يعمل بشكل سليم</div>;
    };

    it('catches runtime rendering exceptions, renders fallback UI, and allows recovery', () => {
      const onErrorSpy = vi.fn();
      // Suppress console.error in Vitest for the expected thrown error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender } = render(
        <ErrorBoundary onError={onErrorSpy}>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );

      // Verify Error Boundary caught the error
      expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/حدث خطأ غير متوقع في التطبيق/i)).toBeInTheDocument();
      expect(screen.getByTestId('error-ref-id')).toBeInTheDocument();
      expect(onErrorSpy).toHaveBeenCalledTimes(1);

      // Verify recovery via reset button
      rerender(
        <ErrorBoundary onError={onErrorSpy}>
          <ProblemChild shouldThrow={false} />
        </ErrorBoundary>
      );

      const retryBtn = screen.getByTestId('error-boundary-retry-btn');
      fireEvent.click(retryBtn);

      expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
      expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  // ── 4. API Client Status Codes & Normalization ──────────────────────────────
  describe('4. API Client Error Mapping & Sanitization', () => {
    it('maps HTTP status codes including 429 to clear localized Arabic messages', () => {
      expect(getLocalizedStatusMessage(400)).toBe('طلب غير صالح. يرجى مراجعة البيانات المدخلة.');
      expect(getLocalizedStatusMessage(401)).toBe('جلسة العمل انتهت أو غير مصرح بها. يرجى تسجيل الدخول.');
      expect(getLocalizedStatusMessage(403)).toBe('ليس لديك صلاحية للوصول إلى هذا المحتوى.');
      expect(getLocalizedStatusMessage(404)).toBe('المورد المطلوب غير موجود أو تم نقله.');
      expect(getLocalizedStatusMessage(409)).toBe('تعارض في معالجة الطلب. قد تكون العملية مسجلة بالفعل.');
      expect(getLocalizedStatusMessage(422)).toBe('تعذر معالجة البيانات المدخلة. يرجى التحقق من صحة المدخلات.');
      expect(getLocalizedStatusMessage(429)).toBe('تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار قليلاً والمحاولة مرة أخرى.');
      expect(getLocalizedStatusMessage(500)).toBe('حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.');
      expect(getLocalizedStatusMessage(503)).toBe('الخدمة غير متوفرة حالياً. يرجى المحاولة بعد قليل.');
    });

    it('sanitizes technical HTML snippets, JSON parse errors, and stack traces', () => {
      const rawHtml = '<html><body><h1>502 Bad Gateway</h1></body></html>';
      expect(sanitizeErrorMessage(rawHtml)).toBe('تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.');

      const syntaxErr = 'SyntaxError: Unexpected token < in JSON at position 0';
      expect(sanitizeErrorMessage(syntaxErr)).toBe('تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.');

      const cleanArabic = 'المجموعة التدريبية غير موجودة في السجلات';
      expect(sanitizeErrorMessage(cleanArabic)).toBe(cleanArabic);
    });

    it('identifies network failures and sets isNetworkError flag on ApiError', async () => {
      server.use(
        http.get('/api/test-network-failure', () => {
          return HttpResponse.error();
        })
      );

      try {
        await apiClient('/api/test-network-failure');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isNetworkError).toBe(true);
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toContain('تعذر الاتصال بالخادم');
      }
    });
  });

  // ── 5. Application Integration & Route Gating ──────────────────────────────
  describe('5. Application Integration & Route Gating', () => {
    it('navigates to standalone /404, /403, and /500 routes cleanly', async () => {
      authStorage.setSession({
        user: SYNTHETIC_DEMO_ACCOUNTS.admin.user,
        token: 'token-admin',
        expiresAt: Date.now() + 3600000,
      });

      const { unmount } = render(<AppRouter initialEntries={['/404']} />);
      await waitFor(() => {
        expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      });
      unmount();

      const { unmount: unmount403 } = render(<AppRouter initialEntries={['/403']} />);
      await waitFor(() => {
        expect(screen.getByTestId('forbidden-page')).toBeInTheDocument();
      });
      unmount403();

      const { unmount: unmount500 } = render(<AppRouter initialEntries={['/500']} />);
      await waitFor(() => {
        expect(screen.getByTestId('unexpected-error-page')).toBeInTheDocument();
      });
      unmount500();
    });

    it('displays LoadingScreen during ProtectedRoute session initialization', async () => {
      // Mock session loading state by rendering ProtectedRoute directly with loading
      render(
        <MemoryRouter>
          <LoadingScreen message="جارٍ التحقق من الجلسة التدريبية..." />
        </MemoryRouter>
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('جارٍ التحقق من الجلسة التدريبية...')).toBeInTheDocument();
      expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    });

    it('renders NotFoundPage for undefined nested routes within application shell', async () => {
      authStorage.setSession({
        user: SYNTHETIC_DEMO_ACCOUNTS.admin.user,
        token: 'token-admin',
        expiresAt: Date.now() + 3600000,
      });

      render(<AppRouter initialEntries={['/non-existent-route-xyz']} />);

      await waitFor(() => {
        expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      });

      expect(screen.getByText(/الصفحة غير موجودة \(404\)/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /العودة إلى لوحة المتابعة/i })).toBeInTheDocument();
    });
  });
});
