import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import {
  apiClient,
  ApiError,
  getLocalizedStatusMessage,
  isJsonResponse,
  sanitizeErrorMessage,
} from '@/core/api/apiClient';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Hardened API Client & Error Normalization', () => {
  describe('HTML and Non-JSON Response Handling', () => {
    it('throws typed ApiError instead of SyntaxError when server returns HTML with HTTP 200 (e.g. Vite SPA fallback)', async () => {
      server.use(
        http.get('/api/test-html-200', () => {
          return new HttpResponse(
            '<!doctype html><html><head><title>Vite App</title></head><body><div id="root"></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
      );

      try {
        await apiClient('/api/test-html-200');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(200);
        expect(apiErr.message).toContain('استجابة غير متوقعة من الخادم');
        expect(apiErr.message).not.toContain('<!doctype');
        expect(apiErr.message).not.toContain('Unexpected token');
        expect(apiErr.name).toBe('ApiError');
      }
    });

    it('throws typed ApiError with localized Arabic message when server returns HTML error with HTTP 404', async () => {
      server.use(
        http.get('/api/test-html-404', () => {
          return new HttpResponse('<html><body>404 Not Found</body></html>', {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
          });
        })
      );

      try {
        await apiClient('/api/test-html-404');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.message).toBe('المورد المطلوب غير موجود أو غير متاح.');
      }
    });

    it('throws typed ApiError with localized Arabic message when server returns HTML error with HTTP 500', async () => {
      server.use(
        http.get('/api/test-html-500', () => {
          return new HttpResponse('<html><body>500 Internal Server Error</body></html>', {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          });
        })
      );

      try {
        await apiClient('/api/test-html-500');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.message).toBe('حدث خطأ في الخادم أثناء معالجة الطلب. يرجى المحاولة لاحقاً.');
      }
    });
  });

  describe('Malformed JSON Handling', () => {
    it('catches invalid JSON in 200 response and wraps it in typed ApiError without throwing SyntaxError', async () => {
      server.use(
        http.get('/api/test-malformed-json', () => {
          return new HttpResponse('{ invalid-json, missing-quotes: true', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      );

      try {
        await apiClient('/api/test-malformed-json');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(200);
        expect(apiErr.message).toBe('تعذر معالجة استجابة الخادم بسبب تنسيق بيانات غير صالح.');
        expect(apiErr.message).not.toContain('Unexpected token');
      }
    });
  });

  describe('Network and Connection Failure Handling', () => {
    it('wraps fetch network failures in typed ApiError with isNetworkError flag and Arabic message', async () => {
      server.use(
        http.get('/api/test-network-error', () => {
          return HttpResponse.error();
        })
      );

      try {
        await apiClient('/api/test-network-error');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isNetworkError).toBe(true);
        expect(apiErr.status).toBe(0);
        expect(apiErr.message).toContain('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت');
      }
    });
  });

  describe('HTTP Status Code Arabic Message Mapping', () => {
    it('maps HTTP 400, 401, 403, 404, 409, 500, 503 to clear Arabic messages', () => {
      expect(getLocalizedStatusMessage(400)).toContain('طلب غير صالح');
      expect(getLocalizedStatusMessage(401)).toContain('جلسة العمل انتهت أو غير مصرح بها');
      expect(getLocalizedStatusMessage(403)).toContain('ليس لديك صلاحية');
      expect(getLocalizedStatusMessage(404)).toContain('المورد المطلوب غير موجود');
      expect(getLocalizedStatusMessage(409)).toContain('تعارض في معالجة الطلب');
      expect(getLocalizedStatusMessage(500)).toContain('حدث خطأ داخلي في الخادم');
      expect(getLocalizedStatusMessage(503)).toContain('الخدمة غير متوفرة حالياً');
      expect(getLocalizedStatusMessage(502)).toContain('الخدمة غير متوفرة حالياً');
    });

    it('extracts safe server-provided JSON error message when available', async () => {
      server.use(
        http.post('/api/test-custom-error', () => {
          return HttpResponse.json(
            { message: 'هذا الحساب معطل حالياً من قبل الإدارة.' },
            { status: 403 }
          );
        })
      );

      try {
        await apiClient('/api/test-custom-error', { method: 'POST' });
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toBe('هذا الحساب معطل حالياً من قبل الإدارة.');
      }
    });

    it('filters out raw HTML server messages and falls back to localized status message', async () => {
      server.use(
        http.get('/api/test-unsafe-error', () => {
          return HttpResponse.json(
            { message: '<div>Internal Server Exception: null pointer</div>' },
            { status: 500 }
          );
        })
      );

      try {
        await apiClient('/api/test-unsafe-error');
        expect.unreachable('Should have thrown an ApiError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.message).toBe('حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.');
      }
    });
  });

  describe('204 No Content Handling', () => {
    it('returns empty object without attempting JSON parsing for 204 No Content', async () => {
      server.use(
        http.delete('/api/test-no-content', () => {
          return new HttpResponse(null, { status: 204 });
        })
      );

      const res = await apiClient('/api/test-no-content', { method: 'DELETE' });
      expect(res).toEqual({});
    });
  });

  describe('sanitizeErrorMessage Helper', () => {
    it('replaces HTML doctype and tags with user-friendly Arabic fallback', () => {
      const sanitized = sanitizeErrorMessage(
        "<!doctype html><html><body><h1>502 Bad Gateway</h1></body></html>",
        'تعذر الاتصال بالخادم.'
      );
      expect(sanitized).toBe('تعذر الاتصال بالخادم.');
    });

    it('replaces Unexpected token parser error with user-friendly Arabic fallback', () => {
      const sanitized = sanitizeErrorMessage(
        'Unexpected token \'<\', "<!doctype "... is not valid JSON',
        'تعذر معالجة البيانات.'
      );
      expect(sanitized).toBe('تعذر معالجة البيانات.');
    });

    it('replaces SyntaxError and TypeError with fallback', () => {
      expect(sanitizeErrorMessage('SyntaxError: JSON.parse error')).toContain('تعذر إتمام العملية');
      expect(sanitizeErrorMessage('TypeError: Failed to fetch')).toContain('تعذر إتمام العملية');
    });

    it('preserves clean Arabic and safe user-facing error messages', () => {
      const safeMsg = 'الدورة التدريبية غير متاحة للتسجيل حالياً.';
      expect(sanitizeErrorMessage(safeMsg)).toBe(safeMsg);
    });
  });

  describe('isJsonResponse Helper', () => {
    it('correctly identifies application/json and vendor variations', () => {
      expect(isJsonResponse('application/json')).toBe(true);
      expect(isJsonResponse('application/json; charset=utf-8')).toBe(true);
      expect(isJsonResponse('application/problem+json')).toBe(true);
      expect(isJsonResponse('text/html')).toBe(false);
      expect(isJsonResponse('text/plain')).toBe(false);
      expect(isJsonResponse(null)).toBe(false);
    });
  });
});
