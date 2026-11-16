import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  apiClient,
  ApiError,
  getLocalizedStatusMessage,
  sanitizeErrorMessage,
} from '@/core/api/apiClient';
import { isDemoAuthMode } from '@/core/auth/AuthContext';

describe('Verification Point 1 — Production Guard for Demo Authentication', () => {
  it('disables Demo auth in normal development mode (real Django cookie session)', () => {
    expect(isDemoAuthMode({ DEV: true, PROD: false, MODE: 'development' })).toBe(false);
  });

  it('enables Demo auth in explicit demo mode and preserves test mode', () => {
    expect(isDemoAuthMode({ DEV: true, PROD: false, MODE: 'demo' })).toBe(true);
    expect(isDemoAuthMode({ DEV: true, PROD: false, MODE: 'test' })).toBe(true);
  });

  it('permanently blocks Demo auth in production even when VITE_DEMO_MODE=true', () => {
    expect(
      isDemoAuthMode({ DEV: false, PROD: true, MODE: 'production', VITE_DEMO_MODE: 'true' })
    ).toBe(false);
    expect(
      isDemoAuthMode({ DEV: true, PROD: false, MODE: 'production', VITE_DEMO_MODE: 'true' })
    ).toBe(false);
    expect(
      isDemoAuthMode({ DEV: true, PROD: true, MODE: 'demo', VITE_DEMO_MODE: 'true' })
    ).toBe(false);
  });
});

describe('Verification Point 2 — HTTP Status Preservation & Non-JSON Response Handling', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns parsed data for HTTP 200 with valid JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, count: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const data = await apiClient<{ ok: boolean; count: number }>('/api/courses');
    expect(data).toEqual({ ok: true, count: 3 });
  });

  it('preserves HTTP 200 (never falsified to 500) on unexpected HTML response', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('<!doctype html><html><body>SPA</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    try {
      await apiClient('/api/courses');
      expect.unreachable('Expected ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(200);
      expect(apiErr.isNetworkError).toBe(false);
      expect(apiErr.message).toBe('حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.');
      expect(apiErr.message).not.toMatch(/HTML|JSON|MSW/i);
      expect(warnSpy).toHaveBeenCalled();
    }
  });

  it('preserves HTTP 200 on unexpected non-JSON content type (text/plain)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('plain text', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(apiClient('/api/courses')).rejects.toMatchObject({
      status: 200,
      isNetworkError: false,
      message: 'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
    });
  });

  it('preserves HTTP 200 on invalid JSON payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{invalid-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient('/api/courses')).rejects.toMatchObject({
      status: 200,
      isNetworkError: false,
      message: 'تعذر معالجة استجابة الخادم بسبب تنسيق بيانات غير صالح.',
    });
  });

  it('preserves HTTP 500 with JSON error response and sanitizes technical messages', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'pyodbc.ProgrammingError on MSSQLSERVER' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(apiClient('/api/courses')).rejects.toMatchObject({
      status: 500,
      message: 'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
    });
  });

  it('preserves HTTP 500 with HTML error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('<html><body><h1>500 Server Error</h1></body></html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    await expect(apiClient('/api/courses')).rejects.toMatchObject({
      status: 500,
      message: 'حدث خطأ في الخادم أثناء معالجة الطلب. يرجى المحاولة لاحقاً.',
    });
  });
});

describe('Verification Point 3 — Error Sanitization, Network/Timeout & Sensitive Info Protection', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('distinguishes HTTP 503, Network failure, TimeoutError, 401, 403, and 500', async () => {
    expect(getLocalizedStatusMessage(401)).toBe(
      'جلسة العمل انتهت أو غير مصرح بها. يرجى تسجيل الدخول.'
    );
    expect(getLocalizedStatusMessage(403)).toBe('ليس لديك صلاحية للوصول إلى هذا المحتوى.');
    expect(getLocalizedStatusMessage(500)).toBe(
      'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.'
    );
    expect(getLocalizedStatusMessage(503)).toBe(
      'الخدمة غير متوفرة حالياً. يرجى المحاولة بعد قليل.'
    );

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiClient('/api/courses')).rejects.toMatchObject({
      status: 0,
      isNetworkError: true,
      message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
    });

    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    await expect(apiClient('/api/auth/me')).rejects.toMatchObject({
      status: 0,
      isNetworkError: true,
      message: 'تعذر الاتصال بالخادم (انتهت مهلة الطلب)',
    });
  });

  it('blocks MSW, SQL Server, connection strings, Windows paths, Python/Django traces, and credentials', () => {
    const fallback = 'تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.';
    const adversarialInputs = [
      'خدمة محاكاة واجهة البرمجة (MSW) غير متوفرة أو لم تبدأ بعد.',
      'Mock Service Worker failed to register (MSW_NOT_ACTIVE)',
      'فشل تسجيل الدخول في بيئة التطوير: لم يتم استلام رمز جلسة المحاكاة (mock token).',
      'SyntaxError: Unexpected token < in JSON at position 0',
      'TypeError: Cannot read properties of undefined at AuthContext.tsx:120',
      'pyodbc.OperationalError: [Microsoft][ODBC Driver 18 for SQL Server] Login failed on MSSQLSERVER',
      'DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost;PWD=Secret123',
      'File "D:\\LMS MEtro Project\\backend\\apps\\identity\\views.py", line 42',
      'Traceback (most recent call last): django.db.utils.IntegrityError',
      'Error in frontend/src/core/api/apiClient.ts or backend/apps/identity/models.py',
      'sessionid=xyz123abc; csrftoken=secret999',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
    ];

    for (const raw of adversarialInputs) {
      expect(sanitizeErrorMessage(raw, fallback)).toBe(fallback);
    }
  });

  it('preserves valid documented Arabic business-level validation messages', () => {
    const fallback = 'تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.';
    const validBusinessMessages = [
      'رقم الهاتف غير صالح. يرجى إدخال رقم هاتف مصري صحيح.',
      'غير مصرح لك بتعديل هذا المقرر.',
      'يرجى تحديد موعد انتهاء أولًا',
      'لا يمكن حذف المحاضر الأساسي قبل إعادة إسناد المقرر.',
    ];

    for (const valid of validBusinessMessages) {
      expect(sanitizeErrorMessage(valid, fallback)).toBe(valid);
    }
  });
});
