import { authStorage } from '@/core/auth/authStorage';
import {
  isRolePreviewMutationBlocked,
  setRolePreviewMutationBarrier,
  triggerRolePreviewBlockedNotification,
  ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
} from '@/core/auth/previewMutationBarrier';
import { getCurrentSessionEpoch, isStaleEpoch } from '@/core/auth/sessionEpoch';

/**
 * Standard typed API error representing network, HTTP, or data-parsing failures.
 */
export class ApiError extends Error {
  status: number;
  data: unknown;
  url?: string;
  isNetworkError: boolean;

  constructor(
    message: string,
    status: number,
    data?: unknown,
    url?: string,
    isNetworkError = false
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.url = url;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Error thrown when an asynchronous API operation resolves after the authenticated
 * session has transitioned to another identity or become unauthenticated (WP-5.4.2).
 * Prevents stale in-flight responses and delayed error handlers from mutating state.
 */
export class StaleEpochError extends Error {
  readonly status = 0;
  readonly requestEpoch: number;
  readonly currentEpoch: number;
  readonly isStale: boolean = true;
  readonly isNetworkError: boolean = false;
  readonly url?: string;

  constructor(requestEpoch: number, currentEpoch: number, url?: string) {
    super(
      `Stale API response discarded: request epoch ${requestEpoch} superseded by session epoch ${currentEpoch}${
        url ? ` for ${url}` : ''
      }.`
    );
    this.name = 'StaleEpochError';
    this.requestEpoch = requestEpoch;
    this.currentEpoch = currentEpoch;
    this.url = url;
  }
}

export function isStaleEpochError(error: unknown): error is StaleEpochError {
  return (
    error instanceof StaleEpochError ||
    (typeof error === 'object' && error !== null && (error as { isStale?: boolean }).isStale === true)
  );
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 * Maps standard HTTP status codes to clean, actionable, user-friendly Arabic error messages.
 */
export function getLocalizedStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'طلب غير صالح. يرجى مراجعة البيانات المدخلة.';
    case 401:
      return 'جلسة العمل انتهت أو غير مصرح بها. يرجى تسجيل الدخول.';
    case 403:
      return 'ليس لديك صلاحية للوصول إلى هذا المحتوى.';
    case 404:
      return 'المورد المطلوب غير موجود أو تم نقله.';
    case 409:
      return 'تعارض في معالجة الطلب. قد تكون العملية مسجلة بالفعل.';
    case 422:
      return 'تعذر معالجة البيانات المدخلة. يرجى التحقق من صحة المدخلات.';
    case 429:
      return 'تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار قليلاً والمحاولة مرة أخرى.';
    case 500:
      return 'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.';
    case 502:
    case 503:
    case 504:
      return 'الخدمة غير متوفرة حالياً. يرجى المحاولة بعد قليل.';
    default:
      if (status >= 500) {
        return 'حدث خطأ في الخادم أثناء معالجة الطلب. يرجى المحاولة لاحقاً.';
      }
      return `حدث خطأ أثناء معالجة الطلب (رمز الخطأ: ${status}).`;
  }
}

/**
 * Inspects whether the response headers denote JSON content.
 */
export function isJsonResponse(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return lower.includes('application/json') || lower.includes('+json');
}

/**
 * Sanitizes any raw or technical error string so that raw stack traces,
 * parser tokens, or HTML documents are never displayed to the user.
 */
export function sanitizeErrorMessage(
  errorMessage: string | null | undefined,
  fallback = 'تعذر إتمام العملية حاليًا. يرجى المحاولة مرة أخرى.'
): string {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return fallback;
  }

  const trimmed = errorMessage.trim();
  if (!trimmed) {
    return fallback;
  }

  // Detect technical error artifacts, HTML snippets, parser exceptions, and internal/sensitive infrastructure details
  const technicalPatterns = [
    /<[!a-zA-Z]/,
    /Unexpected token/i,
    /is not valid JSON/i,
    /JSON\.parse/i,
    /SyntaxError/i,
    /TypeError/i,
    /ReferenceError/i,
    /Failed to fetch/i,
    /NetworkError/i,
    /\bat\b.*\.(?:js|ts|tsx|mjs|cjs|py)\b/i,
    /<!doctype/i,
    /<\/?html/i,
    /\bMSW\b/i,
    /Mock Service Worker/i,
    /MSW_NOT_ACTIVE/i,
    /خدمة محاكاة واجهة البرمجة/,
    /رمز جلسة المحاكاة/,
    /\bmock token\b/i,
    /Traceback \(most recent call last\)/i,
    /File ".*", line \d+/i,
    /\b(?:pyodbc|ODBC Driver|SqlException|MSSQLSERVER|SQLEXPRESS)\b/i,
    /\b(?:ProgrammingError|OperationalError|IntegrityError|SQLExecDirectW|ImproperlyConfigured|TransactionManagementError)\b/i,
    /\b(?:django|rest_framework)\.[a-z0-9_.]+/i,
    /(?:DRIVER=\{|Trusted_Connection=|TrustServerCertificate=|Data Source=|PWD=|PASSWORD=)/i,
    /[A-Za-z]:\\(?:[^\s"'`]+\\)+[^\s"'`]*/,
    /(?:frontend|backend)[\\/](?:src|apps|config|shared)[\\/]/i,
    /\b(?:sessionid|csrftoken)=/i,
    /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }

  return trimmed;
}

/**
 * Safely extracts the Django CSRF token (`csrftoken`) from `document.cookie`.
 * Returns null in non-browser contexts or if the cookie is absent.
 * Safe against malformed percent-encoding; does not throw uncaught exceptions.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Determines whether a target URL shares the same origin as the application.
 * Relative URLs are inherently same-origin.
 */
export function isSameOriginUrl(url: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Core HTTP Client
 *
 * Single location for network transport, header injection,
 * Content-Type validation, safe JSON parsing, and standard error normalization across all feature services.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, headers = {}, ...customConfig } = options;

  // Capture the session transition epoch under which this request was dispatched (WP-5.4.2)
  const requestEpoch = getCurrentSessionEpoch();

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += (url.includes('?') ? '&' : '?') + searchParams.toString();
  }

  const session = authStorage.getSession();
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // In Demo/Test mode only, provide Bearer token fallback for current MSW prototype handlers.
  // In real Django development/production builds, authentication is strictly cookie-based.
  const allowMockBearer =
    !import.meta.env.PROD &&
    import.meta.env.MODE !== 'production' &&
    import.meta.env.DEV &&
    (import.meta.env.MODE === 'demo' ||
      import.meta.env.MODE === 'test' ||
      import.meta.env.VITE_DEMO_MODE === 'true');
  if (allowMockBearer && session?.token) {
    defaultHeaders['Authorization'] = `Bearer ${session.token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    credentials: 'same-origin',
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  // Visual Role Preview Mutation Barrier (MFR-40 / D-10)
  // Intercept state-changing operations during Visual Role Preview to protect Developer authorization authority
  const method = (customConfig.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Attach Django CSRF token for same-origin mutating requests (POST, PUT, PATCH, DELETE)
  if (isMutation && isSameOriginUrl(url)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      (config.headers as Record<string, string>)['X-CSRFToken'] = csrfToken;
    }
  }
  
  // Authentication Lifecycle Exemption: Session termination (POST /api/auth/logout) must never be blocked
  // by Visual Role Preview, ensuring the Developer can safely log out and terminate their session.
  // Gated strictly to method === 'POST' and exact normalized path '/api/auth/logout'.
  const normalizedPath = url.split('?')[0].replace(/\/+$/, '');
  const isSessionTermination = method === 'POST' && normalizedPath === '/api/auth/logout';

  // Authentication Control-Plane Exemption (WP-5.4.2):
  // Lifecycle operations that establish or terminate authenticated identities must not be discarded
  // by their own epoch-advancing response, while separating them cleanly from protected data requests.
  const isAuthControlPlane =
    normalizedPath === '/api/auth/login' ||
    normalizedPath === '/api/auth/logout' ||
    normalizedPath === '/api/auth/me';

  if (isMutation && isRolePreviewMutationBlocked()) {
    if (isSessionTermination) {
      // Deactivate the mutation barrier immediately upon session termination
      setRolePreviewMutationBarrier(false);
    } else {
      triggerRolePreviewBlockedNotification();
      throw new ApiError(
        ROLE_PREVIEW_MUTATION_BLOCKED_MESSAGE,
        403,
        { code: 'ROLE_PREVIEW_MUTATION_BLOCKED', previewBlocked: true },
        url
      );
    }
  }

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
    // Stale In-Flight Protection: discard delayed network errors if session has transitioned (WP-5.4.2)
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('تعذر الاتصال بالخادم (انتهت مهلة الطلب)', 0, null, url, true);
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('تم إلغاء الطلب.', 0, null, url, true);
    }
    // Network offline / server unreachable / connection refused
    throw new ApiError(
      'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
      0,
      null,
      url,
      true
    );
  }

  // Pre-commit epoch validation: discard response immediately if session epoch advanced (WP-5.4.2)
  if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
    throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
  }

  const contentType = response.headers.get('content-type');
  const isJson = isJsonResponse(contentType);

  // Handle 204 No Content
  if (response.status === 204) {
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }
    return {} as T;
  }

  // Handle HTTP error responses (!response.ok)
  if (!response.ok) {
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }

    let errorMessage = getLocalizedStatusMessage(response.status);
    let errorData: unknown = null;

    if (isJson) {
      try {
        errorData = await response.json();
        // Post-parse validation: ensure epoch did not advance while reading error response body (WP-5.4.2 Audit)
        if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
          throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
        }
        if (
          typeof errorData === 'object' &&
          errorData !== null &&
          'message' in errorData &&
          typeof (errorData as { message: unknown }).message === 'string'
        ) {
          const rawServerMessage = (errorData as { message: string }).message.trim();
          const sanitized = sanitizeErrorMessage(rawServerMessage, '');
          if (sanitized) {
            errorMessage = sanitized;
          }
        }
      } catch (err: unknown) {
        if (isStaleEpochError(err)) {
          throw err;
        }
        // Failed to parse JSON error data; fall back to localized status message
      }
    } else {
      // Non-JSON error response (e.g., HTML 404, 502 Bad Gateway, or Vite SPA fallback)
      if (response.status === 404) {
        errorMessage = 'المورد المطلوب غير موجود أو غير متاح.';
      } else if (response.status >= 500) {
        errorMessage = 'حدث خطأ في الخادم أثناء معالجة الطلب. يرجى المحاولة لاحقاً.';
      } else {
        errorMessage = 'استجابة غير صالحة من الخادم. يرجى إعادة المحاولة.';
      }
    }

    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }

    throw new ApiError(errorMessage, response.status, errorData, url);
  }

  // Handle HTTP success responses (response.ok) that are NOT JSON (e.g. Vite SPA fallback serving index.html)
  if (!isJson) {
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }
    if (import.meta.env.DEV) {
      console.warn('[apiClient] Non-JSON response received for', url, 'content-type:', contentType);
    }
    throw new ApiError(
      'حدث خطأ داخلي في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
      response.status,
      null,
      url
    );
  }

  // Safe JSON parsing for valid JSON responses with post-parse epoch validation
  try {
    const data = (await response.json()) as T;
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }
    return data;
  } catch (parseErr: unknown) {
    if (isStaleEpochError(parseErr)) {
      throw parseErr;
    }
    if (!isAuthControlPlane && isStaleEpoch(requestEpoch)) {
      throw new StaleEpochError(requestEpoch, getCurrentSessionEpoch(), url);
    }
    throw new ApiError(
      'تعذر معالجة استجابة الخادم بسبب تنسيق بيانات غير صالح.',
      response.status,
      null,
      url
    );
  }
}
