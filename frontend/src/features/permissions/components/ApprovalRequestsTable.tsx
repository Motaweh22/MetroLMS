import React, { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import type { ApprovalRequest } from '@/core/permissions/types';
import { permissionsApi } from '../services/permissionsApi';

export interface ApprovalRequestsTableProps {
  requests: ApprovalRequest[];
  onReload: () => Promise<void>;
  readOnly?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  'users.create': 'إنشاء حساب جديد',
  'USER_CREATE': 'إنشاء حساب جديد',
  'users.change_role': 'تعديل رتبة مستخدم',
  'USER_ROLE_CHANGE': 'تعديل رتبة مستخدم',
  'users.change_status': 'إيقاف / تنشيط حساب',
  'USER_STATUS_CHANGE': 'إيقاف / تنشيط حساب',
  'users.delete': 'حذف حساب مستخدم',
  'USER_DELETE': 'حذف حساب مستخدم',
  'groups.create': 'إنشاء مجموعة تدريبية',
  'GROUP_CREATE': 'إنشاء مجموعة تدريبية',
  'groups.edit_config': 'تعديل إعدادات مجموعة',
  'GROUP_CONFIG_UPDATE': 'تعديل إعدادات مجموعة',
  'groups.archive': 'أرشفة مجموعة تدريبية',
  'GROUP_ARCHIVE': 'أرشفة مجموعة تدريبية',
  'courses.publish': 'نشر مقرر تدريبي',
  'COURSE_PUBLISH': 'نشر مقرر تدريبي',
  'courses.delete': 'حذف مقرر تدريبي',
  'comments.delete': 'حذف تعليق نهائياً',
  'COMMENT_DELETE': 'حذف تعليق نهائياً',
  'comments.toggle': 'تعديل سياسة نقاش المقرر',
  'COMMENT_TOGGLE': 'تعديل سياسة نقاش المقرر',
};

export const ApprovalRequestsTable: React.FC<ApprovalRequestsTableProps> = ({
  requests,
  onReload,
  readOnly = false,
}) => {
  const toast = useToast();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedReq, setSelectedReq] = useState<ApprovalRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const handleOpenReview = (req: ApprovalRequest, action: 'approve' | 'reject') => {
    setSelectedReq(req);
    setReviewAction(action);
    setReviewNotes('');
  };

  const handleCloseReview = () => {
    if (isSubmitting) return;
    setSelectedReq(null);
    setReviewAction(null);
    setReviewNotes('');
  };

  const handleConfirmReview = async () => {
    if (!selectedReq || !reviewAction) return;

    setIsSubmitting(true);
    try {
      if (reviewAction === 'approve') {
        await permissionsApi.approveApprovalRequest(selectedReq.id, reviewNotes.trim() || undefined);
        toast.success(`تم اعتماد الطلب "${selectedReq.id}" وتنفيذ الإجراء بنجاح.`);
      } else {
        await permissionsApi.rejectApprovalRequest(selectedReq.id, reviewNotes.trim() || undefined);
        toast.info(`تم رفض طلب الاعتماد "${selectedReq.id}".`);
      }
      await onReload();
      handleCloseReview();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة الطلب';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-right" data-testid="approval-requests-container">
      {/* Filters Header */}
      <div className="bg-surface border border-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterStatus === status
                  ? 'bg-primary-dark text-white shadow-sm'
                  : 'bg-bg-alt/70 text-text-muted hover:text-text hover:bg-bg-alt transition-colors'
              }`}
            >
              {status === 'all' && `الكل (${requests.length})`}
              {status === 'pending' && `بانتظار الاعتماد (${requests.filter((r) => r.status === 'pending').length})`}
              {status === 'approved' && `المعتمدة (${requests.filter((r) => r.status === 'approved').length})`}
              {status === 'rejected' && `المرفوضة (${requests.filter((r) => r.status === 'rejected').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm" data-testid="approval-requests-table">
            <thead>
              <tr className="bg-bg-alt/70 border-b border-border text-xs font-semibold text-text-muted select-none">
                <th scope="col" className="py-3.5 px-4 font-bold">رقم الطلب</th>
                <th scope="col" className="py-3.5 px-4 font-bold">نوع العملية</th>
                <th scope="col" className="py-3.5 px-4 font-bold">مقدم الطلب</th>
                <th scope="col" className="py-3.5 px-4 font-bold">المستهدف</th>
                <th scope="col" className="py-3.5 px-4 font-bold">التبرير الإداري</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">الحالة</th>
                <th scope="col" className="py-3.5 px-4 font-bold">التاريخ</th>
                <th scope="col" className="py-3.5 px-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredRequests.map((req) => {
                const isPending = req.status === 'pending';

                return (
                  <tr key={req.id} className="hover:bg-bg/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs text-text-muted">{req.id}</td>
                    <td className="py-3.5 px-4 font-medium text-text">
                      {ACTION_LABELS[req.actionType] || req.actionType}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-text-muted">
                      {req.requestedBy}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {req.targetResourceName ? (
                        <div className="font-semibold text-text truncate max-w-[160px]" title={req.targetResourceName}>
                          {req.targetResourceName}
                        </div>
                      ) : null}
                      <span className="font-mono text-[11px] text-text-muted">{req.targetId || '-'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-muted max-w-xs truncate" title={req.justification}>
                      {req.justification || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {req.status === 'pending' && (
                        <Badge variant="warning" size="sm" icon="pending">
                          معلق
                        </Badge>
                      )}
                      {req.status === 'approved' && (
                        <Badge variant="success" size="sm" icon="check">
                          معتمد
                        </Badge>
                      )}
                      {req.status === 'rejected' && (
                        <Badge variant="danger" size="sm" icon="close">
                          مرفوض
                        </Badge>
                      )}
                      {req.status === 'failed_execution' && (
                        <Badge variant="danger" size="sm" icon="alert" title={req.executionError}>
                          فشل التنفيذ
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-muted">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isPending && !readOnly ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenReview(req, 'approve')}
                            data-testid={`approve-request-btn-${req.id}`}
                          >
                            اعتماد
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleOpenReview(req, 'reject')}
                            data-testid={`reject-request-btn-${req.id}`}
                          >
                            رفض
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">
                          {req.reviewedBy ? `بواسطة ${req.reviewedBy}` : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-text-muted text-xs">
                    <Icon name="checkCircle" size="lg" className="mx-auto text-text-muted mb-2 opacity-40" />
                    لا توجد طلبات اعتماد مطابقة لمعيار التصفية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReq && (
        <Modal
          isOpen={!!selectedReq}
          onClose={handleCloseReview}
          title={reviewAction === 'approve' ? 'تأكيد اعتماد الطلب' : 'رفض طلب الاعتماد'}
          size="md"
        >
          <div className="space-y-4 text-right">
            <p className="text-sm text-text">
              {reviewAction === 'approve'
                ? `هل أنت متأكد من رغبتك في اعتماد الطلب (${selectedReq.id}) وتنفيذ العملية تلقائياً؟`
                : `هل أنت متأكد من رغبتك في رفض هذا الطلب (${selectedReq.id})؟`}
            </p>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">
                ملاحظات المراجعة (اختياري)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                placeholder="أدخل أي ملاحظات توثيقية إضافية..."
                className="w-full px-3 py-2 border border-border rounded-xl text-xs sm:text-sm bg-bg-alt/50 text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                data-testid="review-notes-input"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseReview} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant={reviewAction === 'approve' ? 'primary' : 'danger'}
                size="sm"
                onClick={handleConfirmReview}
                isLoading={isSubmitting}
                data-testid="confirm-review-action-btn"
              >
                {reviewAction === 'approve' ? 'تأكيد الاعتماد' : 'تأكيد الرفض'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
