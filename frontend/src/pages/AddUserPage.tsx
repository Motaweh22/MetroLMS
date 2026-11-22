import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useUnsavedChangesGuard } from '@/core/navigation/useUnsavedChangesGuard';
import { AddUserForm } from '@/features/user-management/components/AddUserForm';

/**
 * Dedicated User Creation Page (/admin/users/new)
 * Replaces the crowded AddUserModal with a structured, sectioned page.
 */
export const AddUserPage: React.FC = () => {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { guardDialog, handleSafeNavigate } = useUnsavedChangesGuard({
    isDirty: isDirty && !isSubmitting,
    title: 'تأكيد مغادرة الصفحة',
    message:
      'لديك بيانات غير محفوظة في نموذج إضافة المستخدم. هل أنت متأكد من رغبتك في المغادرة وتجاهل هذه التغييرات؟',
    confirmLabel: 'نعم، مغادرة الصفحة',
    cancelLabel: 'البقاء والمتابعة',
  });

  const handleNavigateBack = () => {
    if (isSubmitting) return;
    handleSafeNavigate('/admin/users');
  };

  return (
    <div
      role="main"
      data-testid="add-user-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl space-y-6 pb-20"
    >
      {/* Breadcrumb Navigation */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-text-muted">
        <Link
          to="/admin/users"
          data-testid="breadcrumb-users-link"
          className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
        >
          <Icon name="users" size="sm" />
          <span>إدارة دليل المستخدمين</span>
        </Link>
        <span className="text-text-muted/60">←</span>
        <span className="text-text font-bold">إضافة مستخدم جديد</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="user" size="lg" />
            </span>
            إضافة مستخدم جديد
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            تسجيل حساب موظف جديد واستكمال بياناته الشخصية والوظيفية والمؤهل العلمي والصلاحيات
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNavigateBack}
            disabled={isSubmitting}
            data-testid="back-to-users-btn"
            className="w-full sm:w-auto"
          >
            <Icon name="arrowRight" size="sm" className="ml-1.5" />
            العودة إلى دليل المستخدمين
          </Button>
        </div>
      </div>

      {/* Sectioned User Creation Form */}
      <AddUserForm
        isActive
        variant="page"
        onCancel={handleNavigateBack}
        onDirtyChange={setIsDirty}
        onSubmittingChange={setIsSubmitting}
        onUserCreated={() => {
          flushSync(() => setIsDirty(false));
          navigate('/admin/users');
        }}
      />

      {/* Global Navigation Guard Dialog (blocks Sidebar, Topbar, Breadcrumb, Back/Forward, and Cancel) */}
      {guardDialog}
    </div>
  );
};

export default AddUserPage;
