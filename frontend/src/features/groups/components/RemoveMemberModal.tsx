import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { coursesApi } from '@/features/courses/services/coursesApi';
import type { TrainingGroup, GroupMember } from '@/core/groups/types';
import type { Course } from '@/core/courses/types';

export interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: GroupMember | null;
  group: TrainingGroup;
  onConfirm: (memberUserId: string, removeCourseIds: string[]) => Promise<void>;
  isRemoving?: boolean;
  initialCourses?: Course[];
  independentSelfCourseIds?: string[];
}

export const RemoveMemberModal: React.FC<RemoveMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  group,
  onConfirm,
  isRemoving = false,
  initialCourses,
  independentSelfCourseIds = [],
}) => {
  const [courses, setCourses] = useState<Course[]>(initialCourses || []);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(!initialCourses);
  const [selectedRemoveCourseIds, setSelectedRemoveCourseIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Extract unique assigned courses for this group
  const assignedCourseIds = useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(group.courses)) {
      group.courses.forEach((c) => {
        if (c.courseId && c.courseId.trim()) {
          ids.add(c.courseId.trim());
        }
      });
    }
    if (group.courseId && group.courseId.trim()) {
      ids.add(group.courseId.trim());
    }
    return Array.from(ids);
  }, [group]);

  // Reset state and fetch course catalog details when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedRemoveCourseIds([]); // Unchecked by default per D-07
      setActionError(null);
      if (initialCourses && initialCourses.length > 0) {
        setCourses(initialCourses);
        setLoadingCourses(false);
      } else {
        let isSubscribed = true;
        setLoadingCourses(true);
        coursesApi
          .getCourses()
          .then((data) => {
            if (isSubscribed) {
              setCourses(data);
              setLoadingCourses(false);
            }
          })
          .catch(() => {
            if (isSubscribed) {
              setLoadingCourses(false);
            }
          });
        return () => {
          isSubscribed = false;
        };
      }
    } else {
      setSelectedRemoveCourseIds([]);
    }
  }, [isOpen, initialCourses]);

  // Toggle independent course selection
  const handleToggleCourse = (courseId: string) => {
    if (isRemoving) return;
    setSelectedRemoveCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleConfirmClick = async () => {
    if (isRemoving || !member) return;
    try {
      setActionError(null);
      await onConfirm(member.userId, selectedRemoveCourseIds);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام عملية إزالة العضو من المجموعة';
      setActionError(msg);
    }
  };

  if (!member) return null;

  const keptCount = assignedCourseIds.length - selectedRemoveCourseIds.length;
  const removedCount = selectedRemoveCourseIds.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تأكيد إزالة المتدرب من المجموعة التدريبية"
      size="lg"
      dataTestId="remove-member-confirm-dialog"
      footer={
        <div className="flex items-center justify-end gap-3 w-full" dir="rtl">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRemoving}
            data-testid="cancel-remove-member-btn"
          >
            إلغاء التراجع
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmClick}
            isLoading={isRemoving}
            disabled={isRemoving}
            data-testid="confirm-remove-member-btn"
          >
            نعم، قم بإزالة العضو
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-text" dir="rtl">
        {/* Trainee & Group Overview Card */}
        <div className="p-3.5 bg-surface rounded-lg border border-border flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-text-heading">{member.name}</span>
              {member.jobTitle && (
                <Badge variant="neutral" size="sm">
                  {member.jobTitle}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              {member.email && <span>{member.email}</span>}
              {member.department && <span>• {member.department}</span>}
              <span>• معرف المستخدم: {member.userId}</span>
            </div>
          </div>
          <Badge variant="neutral" size="sm">
            {group.name}
          </Badge>
        </div>

        {/* D-07 Authoritative Prompt & Security Explanations */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-text-heading leading-relaxed">
            هل تريد أيضاً إزالة تسجيل المتدرب من أي من المقررات التدريبية التابعة لهذه المجموعة؟ يمكنك تحديد المقررات التي تريد إزالة تسجيله منها.
          </p>
          <div className="text-xs text-text-muted space-y-1 bg-surface-subtle p-3 rounded-lg border border-border/70 leading-normal">
            <p>
              • <strong>المقررات غير المحددة (الافتراضي):</strong> سيحتفظ المتدرب بإمكانية الوصول إلى المقرر ويتم تحويل تسجيله إلى متابعة مستقلة للحفاظ على تقدمه وإنجازه دون الارتباط بمواعيد المجموعة.
            </p>
            <p>
              • <strong>المقررات المحددة:</strong> سيتم إلغاء تسجيل المتدرب في هذا المقرر التابع للمجموعة.
            </p>
            <p className="text-text-muted pt-0.5">
              🔒 <strong>ملاحظة أمان البيانات:</strong> لن يؤدي حذف العضوية أو إلغاء التسجيل إلى مسح سجلات المحاولات أو التقدم التعليمي المكتمل تاريخياً للمتدرب.
            </p>
          </div>
        </div>

        {/* Action Error if any */}
        {actionError && (
          <div
            className="p-3 text-xs text-danger bg-danger-subtle/20 border border-danger/40 rounded-lg"
            data-testid="removal-action-error"
          >
            {actionError}
          </div>
        )}

        {/* Per-Course Selection Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-text-heading">
            <span>المقررات التدريبية المرتبطة بالمجموعة:</span>
            {loadingCourses && <span className="text-text-muted">جاري تحميل بيانات المقررات...</span>}
          </div>

          {assignedCourseIds.length === 0 ? (
            <div
              data-testid="no-group-courses-alert"
              className="p-4 text-center text-sm text-text-muted bg-surface rounded-lg border border-border"
            >
              لا توجد مقررات تدريبية مسندة لهذه المجموعة حالياً. سيتم إخراج المتدرب من عضوية المجموعة فقط.
            </div>
          ) : (
            <div
              className="space-y-2 max-h-60 overflow-y-auto pr-0.5"
              role="group"
              aria-label="قائمة مقررات المجموعة التدريبية"
            >
              {assignedCourseIds.map((cId) => {
                const course = courses.find((c) => c.id.toLowerCase() === cId.toLowerCase());
                const title = course?.title || cId;
                const isSelected = selectedRemoveCourseIds.includes(cId);
                const hasIndependentSelf = independentSelfCourseIds.some(
                  (selfId) => selfId.toLowerCase() === cId.toLowerCase()
                );

                return (
                  <div
                    key={cId}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-danger-subtle/15 border-danger/40'
                        : 'bg-surface border-border hover:bg-surface-hover'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id={`remove-course-${cId}`}
                      checked={isSelected}
                      onChange={() => handleToggleCourse(cId)}
                      disabled={isRemoving}
                      data-testid={`remove-course-checkbox-${cId}`}
                      className="mt-1 h-4 w-4 rounded border-border text-danger focus:ring-danger cursor-pointer disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor={`remove-course-${cId}`}
                      className="flex-1 cursor-pointer select-none space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-text-heading">{title}</span>
                        {isSelected ? (
                          <Badge variant="danger" size="sm" data-testid={`remove-status-badge-${cId}`}>
                            إزالة التسجيل من المقرر
                          </Badge>
                        ) : (
                          <Badge variant="success" size="sm" data-testid={`keep-status-badge-${cId}`}>
                            الاحتفاظ بالمقرر (متابعة مستقلة)
                          </Badge>
                        )}
                      </div>
                      {hasIndependentSelf && (
                        <p
                          className="text-xs text-info flex items-center gap-1 font-normal"
                          data-testid={`independent-self-grant-badge-${cId}`}
                        >
                          <span>ℹ️</span> يمتلك المتدرب تسجيلاً ذاتياً مستقلاً في هذا المقرر لن يتأثر بالإزالة
                        </p>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Decision Summary Box */}
        {assignedCourseIds.length > 0 && (
          <div
            className="p-3 bg-surface rounded-lg border border-border text-xs text-text space-y-1.5"
            dir="rtl"
            data-testid="removal-decision-summary"
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>ملخص قرارات المقررات:</span>
              <span className="text-text-muted">إجمالي المقررات: {assignedCourseIds.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between bg-surface-subtle p-2 rounded">
                <span className="text-text-muted">المقررات المحتفظ بها:</span>
                <span className="font-bold text-success" data-testid="kept-courses-count">
                  {keptCount}
                </span>
              </div>
              <div className="flex items-center justify-between bg-surface-subtle p-2 rounded">
                <span className="text-text-muted">المقررات المراد إزالتها:</span>
                <span
                  className={`font-bold ${removedCount > 0 ? 'text-danger' : 'text-text-muted'}`}
                  data-testid="removed-courses-count"
                >
                  {removedCount}
                </span>
              </div>
            </div>
            <p className="text-text-muted pt-0.5">
              {removedCount === 0
                ? `سيتم إخراج المتدرب من المجموعة فقط، والاحتفاظ بكافة المقررات (${assignedCourseIds.length}) وتحويلها لمتابعة مستقلة للحفاظ على تقدمه.`
                : `ستتم إزالة تسجيل المتدرب من ${removedCount} مقرر(ات) محددة، مع استمراره في دراسة ${keptCount} مقرر(ات) كمتابعة مستقلة.`}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

