import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';

export const Footer: React.FC = () => {
  const { user } = useAuth();

  return (
    <footer className="mt-auto border-t border-border bg-surface/80 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-text-muted">
        {/* Brand & Organization Notice */}
        <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-start">
          <span className="font-bold text-text-heading">
            الشركة المصرية لإدارة وتشغيل المترو
          </span>
          <span className="hidden sm:inline text-border">•</span>
          <span>الإدارة العامة للتدريب وتنمية المهارات البشرية</span>
        </div>

        {/* System Build Status & Roadmap Link */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Badge variant="primary" className="text-[11px] px-2 py-0.5">
            المرحلة 2: هيكل التطبيق (v0.2.0)
          </Badge>

          {/* Surface 11: Developer-only link */}
          {user?.role === 'developer' && (
            <Link
              to="/design-system"
              className="flex items-center gap-1.5 font-medium text-primary hover:text-primary-dark transition-colors"
            >
              <Icon name="palette" size="sm" />
              <span>معمل التصميم</span>
            </Link>
          )}

          <span className="text-border">•</span>
          <span>جميع الحقوق محفوظة © 2026</span>
        </div>
      </div>
    </footer>
  );
};
