import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ManagedUserDTO } from '@/core/user-management/types';
import type { UserOverviewData } from '@/features/profile/services/profileApi';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useToast } from '@/shared/ui/Toast';

export interface DeleteUserModalProps {
  isOpen: boolean;
  user: ManagedUserDTO;
  overview?: UserOverviewData | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({
  isOpen,
  user,
  overview,
  onClose,
  onDeleted,
}) => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const primaryLecturerCourses = useMemo(
    () =>
      (overview?.assignedOrCreatedCourses || []).filter((c) =>
        c.roles.includes('primary_lecturer')
      ),
    [overview]
  );

  const preflightBlocker = useMemo(() => {
    if (currentUser && String(currentUser.id) === String(user.id)) {
      return 'لا يمكنك حذف حسابك الشخصي أثناء تسجيل الدخول.';
    }
    if (user.role === 'developer') {
      return 'لا يمكن حذف حساب المطور (محمي بالنظام).';
    }
    if (user.role === 'super_admin' && currentUser?.role !== 'developer') {
      return 'حذف حساب مسؤول أعلى (Super Admin) مقصور على المطور فقط.';
    }
    if (primaryLecturerCourses.length > 0) {
      return 'لا يمكن حذف هذا المحاضر لأنه ما زال محاضراً رئيسياً لدورات تدريبية نشطة. يجب نقل ملكية هذه الدورات لمحاضر آخر أولاً.';
    }
    return null;
  }, [currentUser, user.id, user.role, primaryLecturerCourses.length]);

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (preflightBlocker) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await userManagementApi.deleteUser(user.id, {
        reason: reason.trim() || 'حذف إداري للحساب',
      });
      toast.success(`تم حذف حساب «${user.name}» نهائياً وفق سياسة الحفاظ على السجلات.`);
      onDeleted();
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'تعذر حذف المستخدم. يرجى مراجعة القيود المرتبطة بالحساب.';
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      data-testid="delete-user-modal"
    >
      <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-danger font-bold text-sm">
            <Icon name="alertCircle" size="sm" />
            <span>حذف حساب المستخدم نهائياً: {user.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text text-sm font-bold"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Pre-flight Deletion Blocker Alert */}
        {preflightBlocker && (
          <Alert variant="danger" title="لا يمكن إتمام الحذف حالياً" data-testid="delete-user-blocker-alert">
            <div className="space-y-2 text-xs">
              <p>{preflightBlocker}</p>
              {primaryLecturerCourses.length > 0 && (
                <ul className="list-disc pr-4 space-y-1">
                  {primaryLecturerCourses.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/lecturer/builder/${encodeURIComponent(c.id)}`}
                        className="font-bold underline hover:text-primary"
                        onClick={onClose}
                      >
                        {c.title} (نقل الملكية من تبويب المحاضرون)
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Alert>
        )}

        {/* Backend Error Alert */}
        {errorMessage && (
          <Alert variant="danger" title="تم رفض عملية الحذف" data-testid="delete-user-error-alert">
            {errorMessage}
          </Alert>
        )}

        {/* Impact Summary */}
        <div className="p-3.5 rounded-xl border border-border bg-surface/60 text-xs space-y-1.5 leading-relaxed">
          <p className="font-bold text-text-heading">تأثير الحذف النهائي (D-01):</p>
          <p className="text-text-muted">
            • <strong>سيتم حذفه:</strong> بيانات الدخول، التسجيلات الحالية، التقدم، الجلسات، والعضوية في المجموعات (مع تحرير الرقم القومي ورقم الهاتف).
          </p>
          <p className="text-text-muted">
            • <strong>سيتم حفظه:</strong> الشهادات الصادرة، الكورسات والميديا والتعليقات (تُنسب إلى سجل أرشيفي آمن).
          </p>
          <p className="text-[11px] text-warning-dark font-semibold">
            ملاحظة: إذا كنت تريد منع الدخول فقط مع إبقاء سجل التقدم، استخدم «إيقاف الحساب» بدلاً من الحذف.
          </p>
        </div>

        {!preflightBlocker && (
          <div className="space-y-1.5">
            <label htmlFor="delete-user-reason" className="block text-xs font-bold text-text-heading">
              سبب الحذف (اختياري للتوثيق)
            </label>
            <input
              id="delete-user-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: انتهاء الخدمة / تسجيل مكرر..."
              className="w-full rounded-xl border border-border px-3 py-2 text-xs"
              data-testid="delete-user-reason-input"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting}>
            إلغاء
          </Button>
          {!preflightBlocker && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              data-testid="confirm-delete-user-btn"
            >
              تأكيد الحذف النهائي
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteUserModal;
