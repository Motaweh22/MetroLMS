import { authStorage } from '@/core/auth/authStorage';

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

  // Detect technical error artifacts, HTML snippets, parser exceptions
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
    /\bat\b.*\.js/i,
    /<!doctype/i,
    /<\/?html/i,
  ];

  for (const pattern of technicalPatterns) {
    if (pattern.test(trimmed)) {
      return fallback;
    }
  }

  return trimmed;
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

  if (session?.token) {
    defaultHeaders['Authorization'] = `Bearer ${session.token}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: unknown) {
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

  const contentType = response.headers.get('content-type');
  const isJson = isJsonResponse(contentType);

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  // Handle HTTP error responses (!response.ok)
  if (!response.ok) {
    let errorMessage = getLocalizedStatusMessage(response.status);
    let errorData: unknown = null;

    if (isJson) {
      try {
        errorData = await response.json();
        if (
          typeof errorData === 'object' &&
          errorData !== null &&
          'message' in errorData &&
          typeof (errorData as { message: unknown }).message === 'string'
        ) {
          const rawServerMessage = (errorData as { message: string }).message.trim();
          // Only use server message if it doesn't contain technical garbage or HTML
          if (rawServerMessage && !/<[!a-zA-Z]/.test(rawServerMessage) && !/SyntaxError|Unexpected/i.test(rawServerMessage)) {
            errorMessage = rawServerMessage;
          }
        }
      } catch {
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

    throw new ApiError(errorMessage, response.status, errorData, url);
  }

  // Handle HTTP success responses (response.ok) that are NOT JSON (e.g. Vite SPA fallback serving index.html)
  if (!isJson) {
    throw new ApiError(
      'استجابة غير متوقعة من الخادم (تم استلام مستند HTML بدلاً من بيانات JSON). يرجى التأكد من تشغيل الخادم.',
      response.status,
      null,
      url
    );
  }

  // Safe JSON parsing for valid JSON responses
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      'تعذر معالجة استجابة الخادم بسبب تنسيق بيانات غير صالح.',
      response.status,
      null,
      url
    );
  }
}
