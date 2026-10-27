import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useAuth } from '@/features/auth';

export interface ForbiddenPageProps {
  /** Optional custom title */
  title?: string;
  /** Optional custom explanation */
  message?: string;
  /** Custom return route */
  returnTo?: string;
}

/**
 * Centrally Managed 403 Forbidden Page
 *
 * Dedicated page rendered when authenticated users attempt to navigate
 * to routes or resources beyond their assigned permission scope.
 */
export const ForbiddenPage: React.FC<ForbiddenPageProps> = ({
  title = 'غير مصرح بالوصول (403)',
  message = 'عذراً، ليس لديك الصلاحيات الكافية للوصول إلى هذا القسم أو المورد التدريبي المطلوب.',
  returnTo,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getAuthorizedHome = (): { path: string; label: string } => {
    if (returnTo) {
      return { path: returnTo, label: 'العودة إلى لوحة المتابعة' };
    }
    if (user?.role === 'admin') {
      return { path: '/dashboard', label: 'العودة إلى لوحة المتابعة' };
    }
    if (user?.role === 'lecturer') {
      return { path: '/lecturer/courses', label: 'العودة إلى مساحة المحاضر' };
    }
    return { path: '/dashboard', label: 'العودة إلى لوحة المتابعة' };
  };

  const destination = getAuthorizedHome();
  const canGoBack = typeof window !== 'undefined' && window.history && window.history.length > 1;

  return (
    <div
      role="main"
      dir="rtl"
      data-testid="forbidden-page"
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center select-none"
    >
      <div className="w-16 h-16 rounded-2xl bg-danger-light text-danger-dark flex items-center justify-center mb-4 shadow-sm">
        <Icon name="lock" size="xl" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-text-heading mb-2">
        {title}
      </h1>

      <p className="text-sm text-text-muted max-w-md mb-2 leading-relaxed">
        {message}
      </p>

      {user && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-alt text-xs text-text-muted mb-6">
          <span>الدور الحالي المسجل:</span>
          <span className="font-bold text-text">
            {user.role === 'admin'
              ? 'مسؤول النظام'
              : user.role === 'lecturer'
              ? 'محاضر معتمد'
              : 'متدرب فني'}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to={destination.path}>
          <Button variant="primary" leftIcon="home">
            {destination.label}
          </Button>
        </Link>

        {canGoBack && (
          <Button
            variant="outline"
            leftIcon="arrowRight"
            onClick={() => navigate(-1)}
            data-testid="forbidden-back-btn"
          >
            الرجوع للصفحة السابقة
          </Button>
        )}
      </div>
    </div>
  );
};

export default ForbiddenPage;
