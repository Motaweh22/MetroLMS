import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  TrainingGroup,
  GroupRenewalCycle,
  GroupCycleCourseAssignment,
  CourseRole,
  PostDeadlinePolicy,
} from '@/core/groups/types';
import type { Course } from '@/core/courses/types';
import {
  getEffectiveCourseSettings,
  validateCycleCourseAssignments,
} from '@/core/domain/groups';
import { groupsApi } from '../services/groupsApi';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { useToast } from '@/shared/ui/Toast';
import { CourseOverrideModal } from './CourseOverrideModal';
import { StartRenewalCycleModal } from './StartRenewalCycleModal';
import { formatArabicDate, formatArabicDateTime } from '../utils/dateUtils';

export interface GroupCoursesTabProps {
  group: TrainingGroup;
  onGroupUpdated: (updatedGroup: TrainingGroup) => void;
}

export const GroupCoursesTab: React.FC<GroupCoursesTabProps> = ({
  group,
  onGroupUpdated,
}) => {
  const toast = useToast();

  const [cycles, setCycles] = useState<GroupRenewalCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active courses for the selected cycle
  const [cycleCourses, setCycleCourses] = useState<GroupCycleCourseAssignment[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add course form
  const [courseToAdd, setCourseToAdd] = useState<string>('');
  const [roleToAdd, setRoleToAdd] = useState<CourseRole>('core');

  // Modal states
  const [overrideTargetCourse, setOverrideTargetCourse] =
    useState<GroupCycleCourseAssignment | null>(null);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState<boolean>(false);

  // Fetch cycles and catalog courses
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fetchedCycles, catalog] = await Promise.all([
        groupsApi.getGroupCycles(group.id),
        coursesApi.getCourses(),
      ]);

      setCycles(fetchedCycles);
      setAvailableCourses(catalog);

      // Select active cycle, or fallback to first
      const active = fetchedCycles.find((c) => c.status === 'active') || fetchedCycles[0];
      if (active) {
        setSelectedCycleId(active.id);
        setCycleCourses(active.courses || []);
      }
      setIsDirty(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات دورات التجديد والمقررات';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [group.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Currently selected cycle object
  const currentCycle = useMemo(() => {
    return cycles.find((c) => c.id === selectedCycleId) || null;
  }, [cycles, selectedCycleId]);

  const isCurrentCycleActive = currentCycle?.status === 'active';

  // Handle cycle switch
  const handleSelectCycle = (cycleId: string) => {
    if (isDirty) {
      const confirmed = window.confirm(
        'لديك تعديلات غير محفوظة في مقررات الدورة الحالية. هل ترغب في تبديل الدورة وتجاهل التغييرات؟'
      );
      if (!confirmed) return;
    }

    setSelectedCycleId(cycleId);
    const target = cycles.find((c) => c.id === cycleId);
    if (target) {
      setCycleCourses(target.courses || []);
    }
    setIsDirty(false);
    setSaveError(null);
  };

  // Add course to cycle
  const handleAddCourse = () => {
    if (!courseToAdd) return;
    if (cycleCourses.some((c) => c.courseId.toLowerCase() === courseToAdd.toLowerCase())) {
      setSaveError('المقرر التدريبي مضاف بالفعل في هذه الدورة');
      return;
    }

    const newAssignment: GroupCycleCourseAssignment = {
      courseId: courseToAdd,
      courseRole: roleToAdd,
      order: cycleCourses.length + 1,
      customStartDateTime: null,
      customDeadlineDateTime: null,
      customPostDeadlinePolicy: null,
    };

    setCycleCourses((prev) => [...prev, newAssignment]);
    setCourseToAdd('');
    setIsDirty(true);
    setSaveError(null);
  };

  // Toggle role between core and reminder
  const handleToggleRole = (courseId: string) => {
    if (!isCurrentCycleActive) return;

    setCycleCourses((prev) =>
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
    setIsDirty(true);
    setSaveError(null);
  };

  // Remove course from cycle
  const handleRemoveCourse = (courseId: string) => {
    if (!isCurrentCycleActive) return;

    setCycleCourses((prev) =>
      prev
        .filter((c) => c.courseId !== courseId)
        .map((c, idx) => ({ ...c, order: idx + 1 }))
    );
    setIsDirty(true);
    setSaveError(null);
  };

  // Move course ordering
  const handleMoveCourse = (index: number, direction: 'up' | 'down') => {
    if (!isCurrentCycleActive) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cycleCourses.length) return;

    const newCourses = [...cycleCourses];
    const temp = newCourses[index];
    newCourses[index] = newCourses[targetIndex];
    newCourses[targetIndex] = temp;

    const reordered = newCourses.map((c, idx) => ({ ...c, order: idx + 1 }));
    setCycleCourses(reordered);
    setIsDirty(true);
    setSaveError(null);
  };

  // Apply course date overrides from modal
  const handleApplyOverride = (override: {
    customStartDateTime: string | null;
    customDeadlineDateTime: string | null;
    customPostDeadlinePolicy: PostDeadlinePolicy | null;
  }) => {
    if (!overrideTargetCourse) return;

    setCycleCourses((prev) =>
      prev.map((c) => {
        if (c.courseId === overrideTargetCourse.courseId) {
          return {
            ...c,
            customStartDateTime: override.customStartDateTime,
            customDeadlineDateTime: override.customDeadlineDateTime,
            customPostDeadlinePolicy: override.customPostDeadlinePolicy,
          };
        }
        return c;
      })
    );
    setIsDirty(true);
    setSaveError(null);
  };

  // Clear overrides directly
  const handleClearOverride = (courseId: string) => {
    if (!isCurrentCycleActive) return;

    setCycleCourses((prev) =>
      prev.map((c) => {
        if (c.courseId === courseId) {
          return {
            ...c,
            customStartDateTime: null,
            customDeadlineDateTime: null,
            customPostDeadlinePolicy: null,
          };
        }
        return c;
      })
    );
    setIsDirty(true);
    setSaveError(null);
  };

  // Save cycle course assignments
  const handleSaveCourses = async () => {
    if (!currentCycle) return;

    const val = validateCycleCourseAssignments(cycleCourses);
    if (!val.isValid) {
      setSaveError(val.error || 'توجد أخطاء في تعيينات المقررات');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      const updatedCycle = await groupsApi.assignCycleCourses(group.id, {
        cycleId: currentCycle.id,
        courses: cycleCourses,
      });

      // Update cycle in state
      setCycles((prev) =>
        prev.map((c) => (c.id === updatedCycle.id ? updatedCycle : c))
      );
      setCycleCourses(updatedCycle.courses || []);
      setIsDirty(false);
      toast.success('تم حفظ تعيينات المقررات التدريبية بنجاح');

      // Refresh group details
      const freshGroup = await groupsApi.getAdminGroupById(group.id);
      onGroupUpdated(freshGroup);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ تعيينات المقررات';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cycle creation callback
  const handleCycleCreated = (newCycle: GroupRenewalCycle) => {
    setCycles((prev) => [
      newCycle,
      ...prev.map((c) => (c.status === 'active' ? { ...c, status: 'completed' as const } : c)),
    ]);
    setSelectedCycleId(newCycle.id);
    setCycleCourses(newCycle.courses || []);
    setIsDirty(false);
  };

  // Unassigned courses for picker
  const unassignedCourses = availableCourses.filter(
    (c) => !cycleCourses.some((cc) => cc.courseId.toLowerCase() === c.id.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-xl border border-border" data-testid="courses-tab-loading">
        <Icon name="clock" size="lg" className="animate-spin text-primary mb-3" />
        <p className="text-text-muted text-sm font-medium">جارٍ تحميل المقررات ودورات التجديد...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div data-testid="courses-tab-load-error">
        <Alert variant="danger" title="خطأ في تحميل المقررات">
          {loadError}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={loadData}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl" data-testid="group-courses-tab">
      {/* ── 1. Renewal Cycle Switcher & Actions Header ──────────────── */}
      <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon name="refresh" size="md" className="text-primary" />
            <h3 className="text-base font-bold text-text">دورات التجديد التدريبي والمقررات</h3>
            {currentCycle && (
              <Badge
                variant={currentCycle.status === 'active' ? 'primary' : 'neutral'}
                size="sm"
                data-testid="selected-cycle-status-badge"
              >
                {currentCycle.status === 'active' ? 'الدورة النشطة الحالية' : 'دورة مكتملة / سابقة'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted">
            إدارة دورات التجديد الدورية، وتعيين المقررات الأساسية والتنشيطية، وتخصيص المواعيد المستقلة.
          </p>
        </div>

        {/* Action: Start New Renewal Cycle */}
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsRenewModalOpen(true)}
          data-testid="start-renew-cycle-btn"
        >
          <Icon name="plus" size="sm" />
          <span>بدء دورة تجديد جديدة</span>
        </Button>
      </div>

      {/* Cycle Tabs / Dropdown Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border" data-testid="cycle-selector-tabs">
        <span className="text-xs font-bold text-text-muted shrink-0 pl-1">اختر دورة التجديد:</span>
        {cycles.map((cyc) => {
          const isSelected = cyc.id === selectedCycleId;
          const isActive = cyc.status === 'active';

          return (
            <button
              key={cyc.id}
              type="button"
              onClick={() => handleSelectCycle(cyc.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 border ${
                isSelected
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface text-text hover:bg-neutral-light border-border'
              }`}
              data-testid={`cycle-tab-${cyc.id}`}
            >
              <span>{cyc.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-neutral-light text-text-muted'
                }`}
              >
                {isActive ? 'نشطة' : 'مكتملة'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Cycle Overview Banner */}
      {currentCycle && (
        <div
          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
            isCurrentCycleActive
              ? 'bg-primary/5 border-primary/20'
              : 'bg-neutral-light/50 border-border'
          }`}
          data-testid="selected-cycle-banner"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text text-sm">{currentCycle.title}</span>
              <span className="text-text-muted text-[11px]">(الدورة {currentCycle.cycleNumber})</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-text-muted text-[11px]">
              <div>
                <span className="font-semibold text-text">تاريخ البداية: </span>
                <span>{formatArabicDateTime(currentCycle.startDateTime)}</span>
              </div>
              <div>
                <span className="font-semibold text-text">الموعد النهائي: </span>
                <span>{formatArabicDateTime(currentCycle.deadlineDateTime)}</span>
              </div>
              <div>
                <span className="font-semibold text-text">سياسة ما بعد الموعد: </span>
                <span>
                  {currentCycle.postDeadlinePolicy === 'hide'
                    ? 'حجب المحتوى (hide)'
                    : 'إتاحة دون شهادة (keep_no_cert)'}
                </span>
              </div>
              {group.renewalSchedule?.autoRenewalEnabled && (
                <div>
                  <span className="font-semibold text-text">التجديد الآلي: </span>
                  <span className="text-primary font-medium" data-testid="auto-renewal-interval-badge">
                    كل {group.renewalSchedule.renewalIntervalDays || group.renewalSchedule.intervalDays} يوماً
                  </span>
                  {group.renewalSchedule.nextScheduledRenewalDate && (
                    <span className="text-text-muted mr-1.5" data-testid="next-scheduled-renewal-text">
                      (القادم: {formatArabicDate(group.renewalSchedule.nextScheduledRenewalDate)})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {!isCurrentCycleActive && (
            <div className="flex items-center gap-1.5 text-text-muted text-[11px] bg-surface px-3 py-1.5 rounded-lg border border-border shrink-0">
              <Icon name="lock" size="sm" />
              <span>دورة سابقة مكتملة ومحمية من التعديل</span>
            </div>
          )}
        </div>
      )}

      {/* Save Error Alert */}
      {saveError && (
        <div data-testid="courses-save-error">
          <Alert variant="danger" title="تعذر حفظ تعيينات المقررات">
            {saveError}
          </Alert>
        </div>
      )}

      {/* ── 2. Add Course to Active Cycle Section ───────────────────── */}
      {isCurrentCycleActive && (
        <div className="bg-surface rounded-2xl p-5 border border-border shadow-xs space-y-3.5" data-testid="add-course-panel">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
              <Icon name="plus" size="sm" className="text-primary" />
              <span>إضافة مقرر تدريبي إلى الدورة الحالية</span>
            </h4>
            <span className="text-[11px] text-text-muted">
              المقرر يمكن أن يكون إما دورة أساسية أو دورة تنشيطية
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={courseToAdd}
              onChange={(e) => setCourseToAdd(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
              data-testid="select-course-to-add"
            >
              <option value="">اختر مقرراً تدريبياً من دليل الدورات المعتمد...</option>
              {unassignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.id}) — المستوى: {c.level}
                </option>
              ))}
            </select>

            <select
              value={roleToAdd}
              onChange={(e) => setRoleToAdd(e.target.value as CourseRole)}
              className="px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary sm:w-52"
              data-testid="select-role-to-add"
            >
              <option value="core">دورة أساسية (Core Course)</option>
              <option value="reminder">دورة تنشيطية (Reminder Course)</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCourse}
              disabled={!courseToAdd}
              data-testid="add-course-btn"
            >
              <Icon name="plus" size="sm" />
              <span>إضافة المقرر</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── 3. Assigned Courses Table / Matrix ──────────────────────── */}
      <div className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden" data-testid="assigned-courses-panel">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="courses" size="sm" className="text-primary" />
            <h4 className="text-xs font-bold text-text">المقررات المعينة في هذه الدورة</h4>
            <Badge variant="neutral" size="sm">
              {cycleCourses.length} مقرر
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>أساسية: {cycleCourses.filter((c) => c.courseRole === 'core').length}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span>تنشيطية: {cycleCourses.filter((c) => c.courseRole === 'reminder').length}</span>
            </span>
          </div>
        </div>

        {cycleCourses.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-xs space-y-2">
            <Icon name="courses" size="lg" className="mx-auto text-text-muted/40 mb-2" />
            <p className="font-semibold text-text">لا توجد مقررات تدريبية معينة في هذه الدورة</p>
            <p>يرجى اختيار مقرر تدريبي وإضافته من القائمة أعلاه لبدء تشغيل الدورة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs" data-testid="assigned-courses-table">
              <thead className="bg-bg text-text-muted border-b border-border text-[11px]">
                <tr>
                  <th className="px-4 py-3 font-semibold w-16 text-center">الترتيب</th>
                  <th className="px-4 py-3 font-semibold min-w-[220px]">المقرر التدريبي</th>
                  <th className="px-4 py-3 font-semibold">التصنيف والهدف</th>
                  <th className="px-4 py-3 font-semibold">تاريخ البداية الفعلي</th>
                  <th className="px-4 py-3 font-semibold">الموعد النهائي الفعلي</th>
                  <th className="px-4 py-3 font-semibold">المواعيد المخصصة</th>
                  <th className="px-4 py-3 font-semibold text-center w-32">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {cycleCourses.map((assignment, index) => {
                  const targetCourse = availableCourses.find(
                    (c) => c.id.toLowerCase() === assignment.courseId.toLowerCase()
                  );
                  const titleText = targetCourse?.title || assignment.courseId;

                  // Resolve effective settings for live preview
                  const effective = getEffectiveCourseSettings(
                    group,
                    assignment,
                    undefined,
                    currentCycle
                  );

                  return (
                    <tr
                      key={assignment.courseId}
                      className="hover:bg-bg/50 transition-colors"
                      data-testid={`course-row-${assignment.courseId}`}
                    >
                      {/* Order and reorder buttons */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-mono font-bold text-text-muted">
                            {assignment.order || index + 1}
                          </span>
                          {isCurrentCycleActive && (
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveCourse(index, 'up')}
                                disabled={index === 0}
                                className="p-0.5 hover:bg-neutral-light rounded disabled:opacity-20 cursor-pointer"
                                title="تحريك لأعلى"
                                data-testid={`move-up-${assignment.courseId}`}
                              >
                                <Icon name="chevronUp" size="sm" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveCourse(index, 'down')}
                                disabled={index === cycleCourses.length - 1}
                                className="p-0.5 hover:bg-neutral-light rounded disabled:opacity-20 cursor-pointer"
                                title="تحريك لأسفل"
                                data-testid={`move-down-${assignment.courseId}`}
                              >
                                <Icon name="chevronDown" size="sm" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Title and ID */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-text leading-snug">{titleText}</div>
                        <div className="text-[11px] text-text-muted font-mono mt-0.5">
                          {assignment.courseId}
                        </div>
                      </td>

                      {/* Course Role: Core vs Reminder */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={assignment.courseRole === 'core' ? 'primary' : 'warning'}
                            size="sm"
                            data-testid={`role-badge-${assignment.courseId}`}
                          >
                            {assignment.courseRole === 'core' ? 'دورة أساسية' : 'دورة تنشيطية'}
                          </Badge>

                          {isCurrentCycleActive && (
                            <button
                              type="button"
                              onClick={() => handleToggleRole(assignment.courseId)}
                              className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                              data-testid={`toggle-role-btn-${assignment.courseId}`}
                            >
                              تبديل إلى {assignment.courseRole === 'core' ? 'تنشيطية' : 'أساسية'}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Effective Start Date */}
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {formatArabicDate(effective.effectiveStartDateTime)}
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          <span
                            className={
                              effective.hasStartOverride
                                ? 'text-primary font-bold'
                                : 'text-text-muted'
                            }
                          >
                            {effective.hasStartOverride
                              ? '• مخصص لهذا المقرر'
                              : effective.inheritedFrom?.start === 'cycle'
                              ? '• موروث من الدورة'
                              : '• موروث من المجموعة'}
                          </span>
                        </div>
                      </td>

                      {/* Effective Deadline Date */}
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {formatArabicDate(effective.effectiveDeadlineDateTime)}
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          <span
                            className={
                              effective.hasDeadlineOverride
                                ? 'text-primary font-bold'
                                : 'text-text-muted'
                            }
                          >
                            {effective.hasDeadlineOverride
                              ? '• مخصص لهذا المقرر'
                              : effective.inheritedFrom?.deadline === 'cycle'
                              ? '• موروث من الدورة'
                              : '• موروث من المجموعة'}
                          </span>
                        </div>
                      </td>

                      {/* Overrides Indicator & Customize Action */}
                      <td className="px-4 py-3">
                        {effective.hasAnyOverride ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="primary" size="sm">
                              مواعيد مخصصة
                            </Badge>
                            {isCurrentCycleActive && (
                              <button
                                type="button"
                                onClick={() => handleClearOverride(assignment.courseId)}
                                className="text-[10px] text-text-muted hover:text-danger hover:underline cursor-pointer"
                                title="استعادة المواعيد الموروثة"
                                data-testid={`clear-override-btn-${assignment.courseId}`}
                              >
                                استعادة
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted text-[11px]">موروثة بالكامل</span>
                        )}
                      </td>

                      {/* Row Actions */}
                      <td className="px-4 py-3 text-center">
                        {isCurrentCycleActive ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setOverrideTargetCourse(assignment)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                              title="تخصيص المواعيد والسياسة"
                              data-testid={`customize-dates-btn-${assignment.courseId}`}
                            >
                              <Icon name="calendar" size="sm" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveCourse(assignment.courseId)}
                              className="p-1.5 text-danger hover:bg-danger/10 rounded-lg cursor-pointer"
                              title="إزالة المقرر من الدورة"
                              data-testid={`remove-course-btn-${assignment.courseId}`}
                            >
                              <Icon name="trash" size="sm" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-muted">مغلق</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Save changes button for active cycle */}
        {isCurrentCycleActive && cycleCourses.length > 0 && (
          <div className="p-4 bg-bg border-t border-border flex items-center justify-between">
            <div className="text-xs text-text-muted">
              {isDirty ? (
                <span className="text-warning-dark font-bold flex items-center gap-1">
                  <Icon name="alert" size="sm" />
                  <span>توجد تعديلات في المقررات أو المواعيد المخصصة لم يتم حفظها بعد</span>
                </span>
              ) : (
                <span className="text-success-dark font-semibold flex items-center gap-1">
                  <Icon name="check" size="sm" />
                  <span>تعيينات المقررات متزامنة مع الخادم</span>
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isSaving}
              disabled={isSaving || !isDirty}
              onClick={handleSaveCourses}
              data-testid="save-cycle-courses-btn"
            >
              <Icon name="save" size="sm" />
              <span>حفظ تعيينات المقررات</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── 4. Modals ────────────────────────────────────────────────── */}
      {/* Date Override Modal */}
      {overrideTargetCourse && (
        <CourseOverrideModal
          isOpen={Boolean(overrideTargetCourse)}
          onClose={() => setOverrideTargetCourse(null)}
          courseId={overrideTargetCourse.courseId}
          courseTitle={
            availableCourses.find(
              (c) => c.id.toLowerCase() === overrideTargetCourse.courseId.toLowerCase()
            )?.title || overrideTargetCourse.courseId
          }
          group={group}
          cycle={currentCycle}
          initialCustomStartDateTime={overrideTargetCourse.customStartDateTime}
          initialCustomDeadlineDateTime={overrideTargetCourse.customDeadlineDateTime}
          initialCustomPostDeadlinePolicy={overrideTargetCourse.customPostDeadlinePolicy}
          onApply={handleApplyOverride}
        />
      )}

      {/* Start New Renewal Cycle Modal */}
      {isRenewModalOpen && (
        <StartRenewalCycleModal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          group={group}
          currentCycle={currentCycle}
          availableCourses={availableCourses}
          onCycleCreated={handleCycleCreated}
        />
      )}
    </div>
  );
};
