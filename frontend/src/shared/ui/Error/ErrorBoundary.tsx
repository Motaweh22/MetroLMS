import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { sanitizeErrorMessage } from '@/core/api/apiClient';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback renderer */
  fallback?: ReactNode | ((error: Error, reset: () => void, errorId: string) => ReactNode);
  /** Optional callback invoked when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional reset handler */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * Generates an opaque, human-friendly error reference ID for support tracking.
 * Format: ERR-XXXXXX (e.g. ERR-A9C3F1)
 */
function generateErrorId(): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ERR-${randomPart}`;
}

/**
 * Standard Production-Ready React Error Boundary
 *
 * Catches unexpected rendering errors in child component trees,
 * prevents blank white screens, displays a localized Arabic fallback UI,
 * and provides safe recovery without leaking sensitive data or stack traces.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Diagnostic logging without polluting end-user UI
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary caught error]:', error, errorInfo);
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;
      const errorId = this.state.errorId || 'ERR-UNKNOWN';

      if (typeof fallback === 'function') {
        return fallback(this.state.error, this.resetErrorBoundary, errorId);
      }

      if (fallback) {
        return fallback;
      }

      const safeMessage = sanitizeErrorMessage(
        this.state.error.message,
        'حدث خطأ غير متوقع أثناء معالجة الصفحة.'
      );

      return (
        <div
          role="alert"
          aria-live="assertive"
          dir="rtl"
          data-testid="error-boundary-fallback"
          className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-danger-light text-danger-dark flex items-center justify-center mx-auto">
              <Icon name="alertCircle" size="xl" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-heading">
                حدث خطأ غير متوقع في التطبيق
              </h2>
              <p className="text-sm text-text-muted leading-relaxed">
                نعتذر عن هذا الخلل المؤقت. لقد تم احتواء الخطأ لمنع توقف المنظومة، ويمكنك المحاولة مجدداً أو العودة للرئيسية.
              </p>
            </div>

            {/* Error Reference Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-alt text-xs font-mono text-text-muted border border-border">
              <span>رمز المرجع:</span>
              <span className="font-bold text-text" data-testid="error-ref-id">{errorId}</span>
            </div>

            {/* Safe development diagnostics */}
            {import.meta.env.DEV && (
              <details className="text-right text-xs bg-bg p-3 rounded-lg border border-border text-danger-dark overflow-auto max-h-32">
                <summary className="cursor-pointer font-bold mb-1 text-text-muted">
                  تفاصيل الخطأ (بيئة التطوير فقط)
                </summary>
                <p className="font-mono">{safeMessage}</p>
              </details>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                leftIcon="refresh"
                onClick={this.resetErrorBoundary}
                data-testid="error-boundary-retry-btn"
              >
                إعادة المحاولة
              </Button>
              <Button
                variant="outline"
                leftIcon="home"
                onClick={() => {
                  this.resetErrorBoundary();
                  window.location.href = '/dashboard';
                }}
              >
                العودة إلى لوحة المتابعة
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
