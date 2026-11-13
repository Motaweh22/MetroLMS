import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import {
  apiClient,
  ApiError,
  StaleEpochError,
  isStaleEpochError,
  getCsrfToken,
  isSameOriginUrl,
  getLocalizedStatusMessage,
  isJsonResponse,
  sanitizeErrorMessage,
} from '@/core/api/apiClient';
import { getCurrentSessionEpoch, advanceSessionEpoch } from '@/core/auth/sessionEpoch';
import {
  setRolePreviewMutationBarrier,
  isRolePreviewMutationBlocked,
  ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
} from '@/core/auth/previewMutationBarrier';
import { authStorage } from '@/core/auth/authStorage';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  setRolePreviewMutationBarrier(false);
  authStorage.clearSession();
  if (typeof document !== 'undefined') {
    document.cookie = 'csrftoken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
});
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

  describe('D-AUTH-01 API Transport, CSRF & Lifecycle Guards', () => {
    it('enforces credentials: "same-origin" on all requests and prevents caller override', async () => {
      let capturedRequest: Request | null = null;
      server.use(
        http.get('/api/test-credentials-barrier', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ status: 'ok' });
        })
      );

      // Caller attempts to pass credentials: 'omit' or 'include'
      await apiClient('/api/test-credentials-barrier', {
        credentials: 'omit' as RequestCredentials,
      });

      expect(capturedRequest).not.toBeNull();
      // MSW requests preserve the credentials policy from fetch
      expect(capturedRequest!.credentials).toBe('same-origin');
    });

    it('merges caller-provided custom headers with default JSON headers', async () => {
      let capturedHeaders: Headers | null = null;
      server.use(
        http.get('/api/test-custom-headers', ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({ status: 'ok' });
        })
      );

      await apiClient('/api/test-custom-headers', {
        headers: {
          'X-Custom-Client-Id': 'MetroLMS-Client-42',
          'X-Correlation-Id': 'corr-abc-123',
        },
      });

      expect(capturedHeaders).not.toBeNull();
      expect(capturedHeaders!.get('Content-Type')).toBe('application/json');
      expect(capturedHeaders!.get('Accept')).toBe('application/json');
      expect(capturedHeaders!.get('X-Custom-Client-Id')).toBe('MetroLMS-Client-42');
      expect(capturedHeaders!.get('X-Correlation-Id')).toBe('corr-abc-123');
    });

    it('extracts CSRF token from document.cookie and handles encoded characters', () => {
      expect(getCsrfToken()).toBeNull();

      document.cookie = 'csrftoken=test-csrf-token-123; Path=/';
      expect(getCsrfToken()).toBe('test-csrf-token-123');

      // Handles URL-encoded tokens
      document.cookie = 'csrftoken=token%20with%20spaces%2Bplus; Path=/';
      expect(getCsrfToken()).toBe('token with spaces+plus');
    });

    it('attaches X-CSRFToken header to mutating requests (POST, PUT, PATCH, DELETE) on same-origin endpoints', async () => {
      document.cookie = 'csrftoken=secure-metro-csrf-999; Path=/';

      const capturedCsrfHeaders: Record<string, string | null> = {};

      server.use(
        http.post('/api/test-csrf-post', ({ request }) => {
          capturedCsrfHeaders['POST'] = request.headers.get('X-CSRFToken');
          return HttpResponse.json({ success: true });
        }),
        http.put('/api/test-csrf-put', ({ request }) => {
          capturedCsrfHeaders['PUT'] = request.headers.get('X-CSRFToken');
          return HttpResponse.json({ success: true });
        }),
        http.patch('/api/test-csrf-patch', ({ request }) => {
          capturedCsrfHeaders['PATCH'] = request.headers.get('X-CSRFToken');
          return HttpResponse.json({ success: true });
        }),
        http.delete('/api/test-csrf-delete', ({ request }) => {
          capturedCsrfHeaders['DELETE'] = request.headers.get('X-CSRFToken');
          return HttpResponse.json({ success: true });
        })
      );

      await apiClient('/api/test-csrf-post', { method: 'POST', body: JSON.stringify({}) });
      await apiClient('/api/test-csrf-put', { method: 'PUT', body: JSON.stringify({}) });
      await apiClient('/api/test-csrf-patch', { method: 'PATCH', body: JSON.stringify({}) });
      await apiClient('/api/test-csrf-delete', { method: 'DELETE' });

      expect(capturedCsrfHeaders['POST']).toBe('secure-metro-csrf-999');
      expect(capturedCsrfHeaders['PUT']).toBe('secure-metro-csrf-999');
      expect(capturedCsrfHeaders['PATCH']).toBe('secure-metro-csrf-999');
      expect(capturedCsrfHeaders['DELETE']).toBe('secure-metro-csrf-999');
    });

    it('does NOT attach X-CSRFToken to safe HTTP methods (GET)', async () => {
      document.cookie = 'csrftoken=secure-metro-csrf-999; Path=/';
      let capturedCsrf: string | null = null;

      server.use(
        http.get('/api/test-csrf-get', ({ request }) => {
          capturedCsrf = request.headers.get('X-CSRFToken');
          return HttpResponse.json({ safe: true });
        })
      );

      await apiClient('/api/test-csrf-get', { method: 'GET' });
      expect(capturedCsrf).toBeNull();
    });

    it('does NOT attach X-CSRFToken to cross-origin URLs', async () => {
      document.cookie = 'csrftoken=secure-metro-csrf-999; Path=/';
      expect(isSameOriginUrl('https://untrusted-external-domain.example/api/upload')).toBe(false);
      expect(isSameOriginUrl('/api/local-endpoint')).toBe(true);
    });

    it('propagates AbortSignal to fetch and converts AbortError into typed cancellation ApiError', async () => {
      server.use(
        http.get('/api/test-abort-signal', async () => {
          // Simulate slow server response
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({ status: 'done' });
        })
      );

      const controller = new AbortController();
      const promise = apiClient('/api/test-abort-signal', {
        signal: controller.signal,
      });

      // Abort immediately
      controller.abort();

      try {
        await promise;
        expect.unreachable('Should have thrown cancellation error');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.isNetworkError).toBe(true);
        expect(apiErr.message).toBe('تم إلغاء الطلب.');
      }
    });

    it('rejects stale in-flight protected requests with StaleEpochError when session epoch advances', async () => {
      let resolveSlowRequest: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolveSlowRequest = resolve;
      });

      server.use(
        http.get('/api/protected-data-slow', async () => {
          await slowPromise;
          return HttpResponse.json({ data: 'confidential' });
        })
      );

      const initialEpoch = getCurrentSessionEpoch();
      const inFlightRequest = apiClient('/api/protected-data-slow');

      // Session epoch advances while request is in-flight (e.g. logout or user switch)
      advanceSessionEpoch();
      expect(getCurrentSessionEpoch()).toBeGreaterThan(initialEpoch);

      // Server finishes response
      resolveSlowRequest!();

      try {
        await inFlightRequest;
        expect.unreachable('Should have thrown StaleEpochError');
      } catch (err: unknown) {
        expect(isStaleEpochError(err)).toBe(true);
        expect(err).toBeInstanceOf(StaleEpochError);
        const staleErr = err as StaleEpochError;
        expect(staleErr.requestEpoch).toBe(initialEpoch);
        expect(staleErr.currentEpoch).toBe(getCurrentSessionEpoch());
      }
    });

    it('blocks mutations during active Visual Role Preview and exempts POST /api/auth/logout', async () => {
      server.use(
        http.post('/api/courses/mutation-attempt', () => {
          return HttpResponse.json({ mutated: true });
        }),
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({ success: true, message: 'Logged out' });
        })
      );

      // Activate preview mutation barrier
      setRolePreviewMutationBarrier(true);
      expect(isRolePreviewMutationBlocked()).toBe(true);

      // 1. Regular mutation must be blocked with HTTP 403 ApiError
      try {
        await apiClient('/api/courses/mutation-attempt', { method: 'POST', body: JSON.stringify({}) });
        expect.unreachable('Should have thrown 403 preview mutation blocked');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toBe(ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE);
      }

      // Barrier remains active after blocked mutation
      expect(isRolePreviewMutationBlocked()).toBe(true);

      // 2. Session termination (POST /api/auth/logout) is exempted and deactivates barrier
      const logoutRes = await apiClient<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
      expect(logoutRes.success).toBe(true);
      // Exemption deactivates barrier to allow clean return
      expect(isRolePreviewMutationBlocked()).toBe(false);
    });
  });
});
