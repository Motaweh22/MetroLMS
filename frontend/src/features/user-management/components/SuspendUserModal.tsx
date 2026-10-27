import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import type { ManagedUserDTO, UserStatus } from '@/core/user-management/types';
import { userManagementApi } from '../services/userManagementApi';

export interface SuspendUserModalProps {
  isOpen: boolean;
  user: ManagedUserDTO | null;
  targetStatus: UserStatus;
  onClose: () => void;
  onSuccess: (updatedUser: ManagedUserDTO) => void;
}

export const SuspendUserModal: React.FC<SuspendUserModalProps> = ({
  isOpen,
  user,
  targetStatus,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const isSuspending = targetStatus === 'suspended';

  const handleClose = () => {
    if (isSubmitting) return;
    setReason('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const updatedUser = await userManagementApi.updateUserStatus(
        user.id,
        targetStatus,
        reason.trim() || undefined
      );

      const actionText = isSuspending ? 'إيقاف' : 'إعادة تنشيط';
      if ((updatedUser as unknown as { approvalRequired?: boolean; message?: string }).approvalRequired) {
        toast.info(
          (updatedUser as unknown as { message?: string }).message ||
            `تم إرسال طلب ${actionText} حساب "${user.name}" للاعتماد؛ بانتظار موافقة مدير النظام.`
        );
        handleClose();
      } else {
        toast.success(`تم ${actionText} حساب "${user.name}" بنجاح.`);
        onSuccess(updatedUser);
        handleClose();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : `تعذر ${isSuspending ? 'إيقاف' : 'تنشيط'} الحساب. يرجى المحاولة مرة أخرى.`;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      hideHeader
      size="md"
      dataTestId={isSuspending ? 'suspend-user-modal' : 'reactivate-user-modal'}
    >
      <div className="space-y-4 text-right">
        {/* Header with Icon */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isSuspending
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-success/10 text-success border border-success/20'
            }`}
          >
            <Icon name={isSuspending ? 'alertCircle' : 'check'} size="md" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-heading">
              {isSuspending ? 'تأكيد إيقاف حساب المستخدم' : 'تأكيد إعادة تنشيط الحساب'}
            </h3>
            <p className="text-xs text-text-muted">
              المستخدم: <span className="font-semibold text-text">{user.name}</span> (@{user.username})
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="danger" title="خطأ أثناء تنفيذ العملية" data-testid="status-mutation-error">
            {error}
          </Alert>
        )}

        {/* Informational Message */}
        <div className="text-xs text-text leading-relaxed bg-bg-alt p-3 rounded-lg border border-border">
          {isSuspending ? (
            <p>
              سيؤدي إيقاف الحساب إلى <strong>منع المستخدم فوراً من تسجيل الدخول</strong> إلى المنصة، واستبعاده
              من قوائم الترشيح للمجموعات التدريبية الجديدة. لن يتم حذف أي بيانات أو محاولات أو سجلات تعليمية سابقة.
            </p>
          ) : (
            <p>
              ستتم استعادة إمكانية تسجيل الدخول للمستخدم بشكل طبيعي، وسيعود للظهور كمرشح مؤهل في المجموعات التدريبية إذا كان يحمل دور متدرب نشط.
            </p>
          )}
        </div>

        {/* Suspension Reason (optional) */}
        {isSuspending && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="suspend-reason" className="text-xs font-semibold text-text">
              سبب الإيقاف <span className="text-text-muted text-[11px]">(اختياري للمراجعة الإدارية)</span>
            </label>
            <input
              id="suspend-reason"
              data-testid="suspend-reason-input"
              type="text"
              disabled={isSubmitting}
              placeholder="مثال: انتهاء فترة الانتداب / بناء على طلب إدارة الموارد البشرية"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-bg text-text text-xs rounded-lg border border-border py-2 px-3 transition-colors outline-none focus:border-primary"
            />
          </div>
        )}

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="status-modal-cancel-btn"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant={isSuspending ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            data-testid={isSuspending ? 'confirm-suspend-btn' : 'confirm-reactivate-btn'}
          >
            {isSuspending ? 'إيقاف الحساب' : 'إعادة التنشيط'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
