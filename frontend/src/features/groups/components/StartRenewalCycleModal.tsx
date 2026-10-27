import React, { useState, useEffect } from 'react';
import type {
  TrainingGroup,
  GroupRenewalCycle,
  GroupCycleCourseAssignment,
  PostDeadlinePolicy,
  CourseRole,
} from '@/core/groups/types';
import type { Course } from '@/core/courses/types';
import { validateDateRange, validateCycleCourseAssignments } from '@/core/domain/groups';
import { groupsApi } from '../services/groupsApi';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import { toDatetimeLocal, toIsoString } from '../utils/dateUtils';

export interface StartRenewalCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: TrainingGroup;
  currentCycle: GroupRenewalCycle | null;
  availableCourses: Course[];
  onCycleCreated: (newCycle: GroupRenewalCycle) => void;
}

export const StartRenewalCycleModal: React.FC<StartRenewalCycleModalProps> = ({
  isOpen,
  onClose,
  group,
  currentCycle,
  availableCourses,
  onCycleCreated,
}) => {
  const toast = useToast();

  const nextCycleNumber = (currentCycle?.cycleNumber || 1) + 1;

  // Form State
  const [title, setTitle] = useState<string>('');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [deadlineDateTime, setDeadlineDateTime] = useState<string>('');
  const [postDeadlinePolicy, setPostDeadlinePolicy] = useState<PostDeadlinePolicy>('keep_no_cert');
  const [renewalNote, setRenewalNote] = useState<string>('');
  const [courses, setCourses] = useState<GroupCycleCourseAssignment[]>([]);
  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState<string>('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<CourseRole>('core');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form when opened
  useEffect(() => {
    if (!isOpen) return;

    setTitle(`${group.name} — دورة التجديد ${nextCycleNumber}`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(8, 0, 0, 0);

    const intervalDays =
      group.renewalSchedule?.renewalIntervalDays ?? group.renewalSchedule?.intervalDays ?? 60;
    const deadlineDate = new Date(startDate);
    deadlineDate.setDate(deadlineDate.getDate() + intervalDays);
    deadlineDate.setHours(18, 0, 0, 0);

    setStartDateTime(toDatetimeLocal(startDate.toISOString()));
    setDeadlineDateTime(toDatetimeLocal(deadlineDate.toISOString()));
    setPostDeadlinePolicy(group.postDeadlinePolicy || 'keep_no_cert');
    setRenewalNote('');
    setErrorMessage(null);

    // Seed courses from current cycle or group baseline
    const sourceCourses: GroupCycleCourseAssignment[] = currentCycle?.courses?.length
      ? currentCycle.courses.map((c, idx) => ({
          courseId: c.courseId,
          courseRole: c.courseRole,
          order: idx + 1,
          customStartDateTime: null,
          customDeadlineDateTime: null,
          customPostDeadlinePolicy: null,
        }))
      : (group.courses || []).map((c, idx) => ({
          courseId: c.courseId,
          courseRole: idx === 0 ? 'core' : 'reminder',
          order: idx + 1,
          customStartDateTime: null,
          customDeadlineDateTime: null,
          customPostDeadlinePolicy: null,
        }));

    setCourses(sourceCourses);
    setSelectedCourseToAdd('');
    setSelectedRoleToAdd('core');
  }, [isOpen, group, currentCycle, nextCycleNumber]);

  // Add course to new cycle
  const handleAddCourse = () => {
    if (!selectedCourseToAdd) return;
    if (courses.some((c) => c.courseId.toLowerCase() === selectedCourseToAdd.toLowerCase())) {
      setErrorMessage('المقرر التدريبي مضاف بالفعل في هذه الدورة');
      return;
    }

    setCourses((prev) => [
      ...prev,
      {
        courseId: selectedCourseToAdd,
        courseRole: selectedRoleToAdd,
        order: prev.length + 1,
        customStartDateTime: null,
        customDeadlineDateTime: null,
        customPostDeadlinePolicy: null,
      },
    ]);
    setSelectedCourseToAdd('');
    setErrorMessage(null);
  };

  // Toggle role between core and reminder
  const handleToggleRole = (courseId: string) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.courseId === courseId) {
          return {
            ...c,
            courseRole: c.courseRole === 'core' ? 'reminder' : 'core',
          };
        }
        return c;
      })
    );
  };

  // Remove course from new cycle
  const handleRemoveCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.courseId !== courseId));
  };

  // Move course up or down
  const handleMoveCourse = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= courses.length) return;

    const newCourses = [...courses];
    const temp = newCourses[index];
    newCourses[index] = newCourses[targetIndex];
    newCourses[targetIndex] = temp;

    // re-index order
    const updated = newCourses.map((c, idx) => ({ ...c, order: idx + 1 }));
    setCourses(updated);
  };

  // Submit new cycle
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate title
    if (!title.trim()) {
      setErrorMessage('عنوان دورة التجديد مطلوب');
      return;
    }

    // Validate dates
    const startIso = toIsoString(startDateTime);
    const deadlineIso = toIsoString(deadlineDateTime);
    const dateVal = validateDateRange(startIso, deadlineIso);
    if (!dateVal.isValid) {
      setErrorMessage(dateVal.error || 'الموعد النهائي يجب أن يكون لاحقاً لتاريخ البداية');
      return;
    }

    // Validate courses
    const courseVal = validateCycleCourseAssignments(courses);
    if (!courseVal.isValid) {
      setErrorMessage(courseVal.error || 'يرجى مراجعة المقررات المعينة في الدورة');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        startDateTime: startIso,
        deadlineDateTime: deadlineIso,
        postDeadlinePolicy,
        renewalNote: renewalNote.trim() || undefined,
        courses: courses.map((c, idx) => ({
          courseId: c.courseId,
          courseRole: c.courseRole,
          order: idx + 1,
          customStartDateTime: c.customStartDateTime,
          customDeadlineDateTime: c.customDeadlineDateTime,
          customPostDeadlinePolicy: c.customPostDeadlinePolicy,
        })),
      };

      const result = await groupsApi.renewCycle(group.id, payload);
      toast.success(`تم بدء دورة التجديد التدريبي رقم ${result.newCycle.cycleNumber} بنجاح`);
      onCycleCreated(result.newCycle);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء دورة التجديد';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter available courses not yet in list
  const unassignedCourses = availableCourses.filter(
    (c) => !courses.some((ac) => ac.courseId.toLowerCase() === c.id.toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="بدء دورة تجديد تدريبي جديدة للمجموعة"
      size="xl"
      dataTestId="start-renewal-cycle-modal"
    >
      <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
        {/* Preservation Guarantee Banner */}
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 flex items-start gap-3">
          <Icon name="refresh" size="md" className="text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-text space-y-1">
            <h5 className="font-bold text-primary">ضمان الحفاظ على السجلات التاريخية والمحاولات</h5>
            <p className="text-text-muted leading-relaxed">
              بدء دورة التجديد (الدورة {nextCycleNumber}) سيقوم بإغلاق الدورة الحالية كدورة مكتملة.
              المتدربون الذين سيكررون مقررات في هذه الدورة ستبدأ لهم محاولات تدريبية جديدة بنسبة 0%، مع بقاء كافة محاولاتهم وإنجازاتهم في الدورات السابقة محفوظة بشكل دائم في سجل المحاولات.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="font-semibold text-text">فترة دورة التجديد المعتمدة:</span>
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold" data-testid="modal-interval-chip">
                {group.renewalSchedule?.renewalIntervalDays || group.renewalSchedule?.intervalDays || 60} يوماً
              </span>
              <span className="text-text-muted">
                (بدء دورة يدوي مستقل عن موعد التجديد الآلي المجدول)
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div data-testid="renew-error-banner">
            <Alert variant="danger" title="تعذر بدء دورة التجديد">
              {errorMessage}
            </Alert>
          </div>
        )}

        {/* Basic Cycle Details */}
        <div className="space-y-4">
          <div>
            <label htmlFor="cycle-title-input" className="block text-xs font-semibold text-text mb-1">
              عنوان دورة التجديد <span className="text-danger">*</span>
            </label>
            <input
              id="cycle-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="cycle-title-input"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cycle-start-input" className="block text-xs font-semibold text-text mb-1">
                تاريخ وبدء الدورة <span className="text-danger">*</span>
              </label>
              <input
                id="cycle-start-input"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="cycle-start-input"
                required
              />
            </div>

            <div>
              <label htmlFor="cycle-deadline-input" className="block text-xs font-semibold text-text mb-1">
                الموعد النهائي للدورة <span className="text-danger">*</span>
              </label>
              <input
                id="cycle-deadline-input"
                type="datetime-local"
                value={deadlineDateTime}
                onChange={(e) => setDeadlineDateTime(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="cycle-deadline-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cycle-policy-select" className="block text-xs font-semibold text-text mb-1">
                سياسة ما بعد انتهاء الموعد
              </label>
              <select
                id="cycle-policy-select"
                value={postDeadlinePolicy}
                onChange={(e) => setPostDeadlinePolicy(e.target.value as PostDeadlinePolicy)}
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="cycle-policy-select"
              >
                <option value="keep_no_cert">إتاحة المحتوى للقراءة دون إصدار شهادة (keep_no_cert)</option>
                <option value="hide">حجب المحتوى التدريبي تماماً (hide)</option>
              </select>
            </div>

            <div>
              <label htmlFor="cycle-note-input" className="block text-xs font-semibold text-text mb-1">
                ملاحظات أو مبررات التجديد (اختياري)
              </label>
              <input
                id="cycle-note-input"
                type="text"
                value={renewalNote}
                onChange={(e) => setRenewalNote(e.target.value)}
                placeholder="مثال: تجديد سنوي دوري لكافة فنيي الورش"
                className="w-full px-3 py-2 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                data-testid="cycle-note-input"
              />
            </div>
          </div>
        </div>

        {/* Cycle Courses Assignment Section */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-bold text-text">تعيين المقررات في الدورة الجديدة</h5>
            <span className="text-xs text-text-muted">
              {courses.filter((c) => c.courseRole === 'core').length} أساسية |{' '}
              {courses.filter((c) => c.courseRole === 'reminder').length} تنشيطية
            </span>
          </div>

          {/* Add Course bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-bg p-3 rounded-xl border border-border">
            <select
              value={selectedCourseToAdd}
              onChange={(e) => setSelectedCourseToAdd(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="add-course-select"
            >
              <option value="">اختر مقرراً تدريبياً لإضافته للدورة...</option>
              {unassignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.id})
                </option>
              ))}
            </select>

            <select
              value={selectedRoleToAdd}
              onChange={(e) => setSelectedRoleToAdd(e.target.value as CourseRole)}
              className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="add-role-select"
            >
              <option value="core">دورة أساسية (Core)</option>
              <option value="reminder">دورة تنشيطية (Reminder)</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCourse}
              disabled={!selectedCourseToAdd}
              data-testid="add-course-btn"
            >
              <Icon name="plus" size="sm" />
              <span>إضافة</span>
            </Button>
          </div>

          {/* Courses List */}
          {courses.length === 0 ? (
            <div className="text-center py-6 bg-surface rounded-xl border border-dashed border-border text-xs text-text-muted">
              لم يتم تعيين أي مقررات بعد. يجب إضافة مقرر تدريبي واحد على الأقل.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {courses.map((c, index) => {
                const targetCourse = availableCourses.find(
                  (ac) => ac.id.toLowerCase() === c.courseId.toLowerCase()
                );
                const titleText = targetCourse?.title || c.courseId;

                return (
                  <div
                    key={c.courseId}
                    className="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-border text-xs"
                    data-testid={`cycle-course-item-${c.courseId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-neutral-light flex items-center justify-center font-bold text-[10px] text-text-muted shrink-0">
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-bold text-text block truncate">{titleText}</span>
                        <span className="text-[10px] text-primary font-mono">{c.courseId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(c.courseId)}
                        className="cursor-pointer"
                        title="انقر للتبديل بين دورة أساسية وتنشيطية"
                        data-testid={`toggle-role-btn-${c.courseId}`}
                      >
                        <Badge variant={c.courseRole === 'core' ? 'primary' : 'warning'} size="sm">
                          {c.courseRole === 'core' ? 'دورة أساسية' : 'دورة تنشيطية'}
                        </Badge>
                      </button>

                      <div className="flex items-center gap-0.5 border-r border-border pr-2">
                        <button
                          type="button"
                          onClick={() => handleMoveCourse(index, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-neutral-light rounded disabled:opacity-30"
                          title="تحريك لأعلى"
                        >
                          <Icon name="chevronUp" size="sm" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveCourse(index, 'down')}
                          disabled={index === courses.length - 1}
                          className="p-1 hover:bg-neutral-light rounded disabled:opacity-30"
                          title="تحريك لأسفل"
                        >
                          <Icon name="chevronDown" size="sm" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCourse(c.courseId)}
                        className="p-1 text-danger hover:bg-danger/10 rounded"
                        title="حذف المقرر من الدورة"
                        data-testid={`remove-cycle-course-${c.courseId}`}
                      >
                        <Icon name="trash" size="sm" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="cancel-renew-btn"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || courses.length === 0}
            data-testid="confirm-renew-btn"
          >
            <Icon name="refresh" size="sm" />
            <span>تأكيد وبدء دورة التجديد {nextCycleNumber}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
