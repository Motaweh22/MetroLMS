import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { BrandLogo } from '@/shared/ui/BrandLogo';
import { useAuth } from '@/features/auth';

export interface NotFoundPageProps {
  /** Force standalone layout with brand header (e.g. for unauthenticated visits) */
  standalone?: boolean;
}

/**
 * Centrally Managed 404 Not Found Page
 *
 * Requirements:
 * - Clear Arabic message explaining requested page was not found
 * - Appropriate icon from semantic icon registry
 * - Primary action returning home/dashboard (role-aware: admin/lecturer/trainee)
 * - Secondary action to go back when browser history allows
 * - Supports rendering inside application shell or as standalone view
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({ standalone = false }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Role-aware primary destination
  const getHomeDestination = (): { path: string; label: string } => {
    if (standalone && (!isAuthenticated || !user)) {
      return { path: '/login', label: 'العودة إلى تسجيل الدخول' };
    }
    if (user?.role === 'lecturer') {
      return { path: '/lecturer/courses', label: 'العودة إلى لوحة المتابعة' };
    }
    return { path: '/dashboard', label: 'العودة إلى لوحة المتابعة' };
  };

  const homeDest = getHomeDestination();
  const canGoBack = typeof window !== 'undefined' && window.history && window.history.length > 1;

  const content = (
    <div
      role="main"
      dir="rtl"
      data-testid="not-found-page"
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12 text-center select-none"
    >
      <div className="w-16 h-16 rounded-2xl bg-danger-light flex items-center justify-center text-danger-dark mb-4 shadow-sm">
        <Icon name="alertCircle" size="xl" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-text-heading mb-2">
        الصفحة غير موجودة (404)
      </h1>

      <p className="text-sm text-text-muted max-w-md mb-6 leading-relaxed">
        المسار المطلوب غير موجود ضمن المنظومة التدريبية، أو ربما تم نقله أو حذفه أو لم يتم تفعيله بعد.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to={homeDest.path}>
          <Button variant="primary" leftIcon="home">
            {homeDest.label}
          </Button>
        </Link>

        {canGoBack && (
          <Button
            variant="outline"
            leftIcon="arrowRight"
            onClick={() => navigate(-1)}
            data-testid="not-found-back-btn"
          >
            الرجوع للصفحة السابقة
          </Button>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return (
      <div className="min-h-screen bg-bg flex flex-col justify-between" dir="rtl">
        <header className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
          <BrandLogo variant="horizontal" size="md" />
          <Link to="/login">
            <Button variant="outline" size="sm" leftIcon="user">
              تسجيل الدخول
            </Button>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center">
          {content}
        </main>

        <footer className="p-4 text-center text-xs text-text-muted border-t border-border">
          الشركة المصرية لإدارة وتشغيل المترو — جميع الحقوق محفوظة © 2026
        </footer>
      </div>
    );
  }

  return content;
};

export default NotFoundPage;
