import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { groupsApi, type AdminEnrichedTrainingGroup } from '@/features/groups/services/groupsApi';
import {
  GroupCoursesTab,
  GroupMembersTab,
  GroupMaterialsTab,
  GroupAttachmentsTab,
  GroupMeetingsTab,
} from '@/features/groups/components';
import type {
  GroupAdminStatus,
  GroupEnrollmentPolicy,
  PostDeadlinePolicy,
  TrainingGroup,
} from '@/core/groups/types';
import type { CandidateLecturerDTO } from '@/core/groups/dtos';
import {
  calculateNextRenewalDateSafe,
  validateRenewalIntervalDays,
  migrateLegacyRecurrenceType,
} from '@/core/domain/groups';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { FormInput } from '@/shared/ui/FormInput';
import { useToast } from '@/shared/ui/Toast';
import { useUnsavedChangesGuard } from '@/core/navigation/useUnsavedChangesGuard';
import { toDatetimeLocal, toIsoString, formatArabicDate } from '@/features/groups/utils/dateUtils';

/**
 * Default starting dates for creation
 */
function getDefaultDates(): { start: string; deadline: string } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const monthLater = new Date(tomorrow);
  monthLater.setDate(monthLater.getDate() + 30);
  monthLater.setHours(18, 0, 0, 0);

  return {
    start: toDatetimeLocal(tomorrow.toISOString()),
    deadline: toDatetimeLocal(monthLater.toISOString()),
  };
}

type RecurrenceOption = 'none' | 'monthly' | 'bimonthly' | 'quarterly' | 'custom';

export type GroupTab =
  | 'general'
  | 'schedule'
  | 'members'
  | 'courses'
  | 'materials'
  | 'meetings';

export const GroupEditorPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const isCreateMode = !groupId || groupId === 'new';

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTabState] = useState<GroupTab>(
    tabParam === 'schedule' || tabParam === 'timing'
      ? 'schedule'
      : tabParam === 'members'
      ? 'members'
      : tabParam === 'courses'
      ? 'courses'
      : tabParam === 'materials'
      ? 'materials'
      : tabParam === 'meetings' || tabParam === 'attachments'
      ? 'meetings'
      : 'general'
  );

  useEffect(() => {
    if (tabParam === 'schedule' || tabParam === 'timing') {
      setActiveTabState('schedule');
    } else if (tabParam === 'members') {
      setActiveTabState('members');
    } else if (tabParam === 'courses') {
      setActiveTabState('courses');
    } else if (tabParam === 'materials') {
      setActiveTabState('materials');
    } else if (tabParam === 'meetings' || tabParam === 'attachments') {
      setActiveTabState('meetings');
    } else if (tabParam === 'general' || !tabParam) {
      setActiveTabState('general');
    }
  }, [tabParam]);

  const handleTabSwitch = (tab: GroupTab) => {
    setActiveTabState(tab);
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'general') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams, { replace: true });
  };

  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'developer';

  // Loaded group in Edit mode
  const [loadedGroup, setLoadedGroup] = useState<AdminEnrichedTrainingGroup | null>(null);
  const [loading, setLoading] = useState<boolean>(!isCreateMode);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [adminStatus, setAdminStatus] = useState<GroupAdminStatus>('active');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [deadlineDateTime, setDeadlineDateTime] = useState<string>('');
  const [postDeadlinePolicy, setPostDeadlinePolicy] = useState<PostDeadlinePolicy>('keep_no_cert');
  const [enrollmentPolicy, setEnrollmentPolicy] = useState<GroupEnrollmentPolicy>('open');
  const [maxTrainees, setMaxTrainees] = useState<string>('');
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState<boolean>(true);
  const [enrollmentExpiresAt, setEnrollmentExpiresAt] = useState<string>('');
  const [, setRecurrenceType] = useState<RecurrenceOption>('none');
  const [autoRenewalEnabled, setAutoRenewalEnabled] = useState<boolean>(false);
  const [renewalIntervalDays, setRenewalIntervalDays] = useState<string>('');
  const [candidateLecturers, setCandidateLecturers] = useState<CandidateLecturerDTO[]>([]);
  const [primaryInstructorId, setPrimaryInstructorId] = useState<string>('');
  const [assistantLecturerIds, setAssistantLecturerIds] = useState<string[]>([]);
  const [selectedAssistantToAdd, setSelectedAssistantToAdd] = useState<string>('');
  const [lecturerSearchQuery, setLecturerSearchQuery] = useState<string>('');

  // Authoritative deadline anchor for renewal:
  // 1. For existing group with an active cycle: the active cycle's deadline date
  // 2. For new group without cycle: the deadline entered in the form
  const authoritativeRenewalDeadline = useMemo(() => {
    if (
      !isCreateMode &&
      loadedGroup?.currentCycle?.deadlineDateTime &&
      deadlineDateTime === toDatetimeLocal(loadedGroup.deadlineDateTime)
    ) {
      return loadedGroup.currentCycle.deadlineDateTime;
    }
    return deadlineDateTime ? toIsoString(deadlineDateTime) : (startDateTime ? toIsoString(startDateTime) : null);
  }, [isCreateMode, loadedGroup, deadlineDateTime, startDateTime]);

  // Live calculated preview of next renewal date based on authoritative anchor (active cycle deadline || group deadline) + N calendar days
  const calculatedNextRenewalPreview = useMemo(() => {
    if (!autoRenewalEnabled || !renewalIntervalDays || !authoritativeRenewalDeadline) return null;
    const nextDateIso = calculateNextRenewalDateSafe(authoritativeRenewalDeadline, renewalIntervalDays);
    if (!nextDateIso) return null;
    return formatArabicDate(nextDateIso);
  }, [autoRenewalEnabled, renewalIntervalDays, authoritativeRenewalDeadline]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Dirty state for unsaved changes guard
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const { guardDialog, handleSafeNavigate: safeNavigate } = useUnsavedChangesGuard({
    isDirty,
    title: 'تعديلات غير محفوظة',
    message: 'لديك تعديلات غير محفوظة في إعدادات المجموعة التدريبية. هل ترغب في مغادرة الصفحة وتجاهل التغييرات؟',
    confirmLabel: 'مغادرة وتجاهل التعديلات',
    cancelLabel: 'البقاء والمتابعة',
  });

  // Populate initial values
  useEffect(() => {
    if (isCreateMode) {
      const { start, deadline } = getDefaultDates();
      setStartDateTime(start);
      setDeadlineDateTime(deadline);
      setLoading(false);
    }
  }, [isCreateMode]);

  // Load eligible lecturer accounts for instructor assignment
  useEffect(() => {
    if (!isAuthenticated || authLoading || !isAdmin) return;
    let isMounted = true;
    groupsApi
      .getCandidateLecturers()
      .then((list) => {
        if (isMounted) {
          setCandidateLecturers(list || []);
        }
      })
      .catch(() => {
        // Fallback handled gracefully
      });
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authLoading, isAdmin]);

  // Load existing group details in Edit mode
  const fetchGroup = useCallback(async () => {
    if (isCreateMode || !groupId) return;

    setLoading(true);
    setLoadError(null);
    try {
      const data = await groupsApi.getAdminGroupById(groupId);
      setLoadedGroup(data);

      setName(data.name || '');
      setDescription(data.description || '');
      setAdminStatus(data.adminStatus || 'active');
      setStartDateTime(toDatetimeLocal(data.startDateTime));
      setDeadlineDateTime(toDatetimeLocal(data.deadlineDateTime));
      setPostDeadlinePolicy(data.postDeadlinePolicy || 'keep_no_cert');
      setEnrollmentPolicy(data.enrollmentPolicy || 'open');
      setMaxTrainees(data.maxTrainees !== null && data.maxTrainees !== undefined ? String(data.maxTrainees) : '');
      setIsEnrollmentOpen(data.isEnrollmentOpen !== false);
      setEnrollmentExpiresAt(toDatetimeLocal(data.enrollmentExpiresAt));
      const normSchedule = migrateLegacyRecurrenceType(data.renewalSchedule);
      setAutoRenewalEnabled(normSchedule.autoRenewalEnabled);
      setRenewalIntervalDays(normSchedule.intervalDays ? String(normSchedule.intervalDays) : '');
      setRecurrenceType((normSchedule.recurrenceType as RecurrenceOption) || 'none');
      const loadedPrimary =
        data.primaryInstructorId !== undefined
          ? data.primaryInstructorId || ''
          : data.instructors?.find((i) => i.instructorRole === 'primary')?.userId || '';
      const loadedAssistants =
        data.assistantLecturerIds !== undefined
          ? [...data.assistantLecturerIds]
          : data.instructors
              ?.filter((i) => i.instructorRole === 'assistant')
              .map((i) => i.userId) || [];
      setPrimaryInstructorId(loadedPrimary);
      setAssistantLecturerIds(loadedAssistants);
      setIsDirty(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر تحميل بيانات المجموعة التدريبية';
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [groupId, isCreateMode]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && !isCreateMode) {
      fetchGroup();
    }
  }, [isAuthenticated, authLoading, isCreateMode, fetchGroup]);

  // Handle Input Changes with dirty marking
  const handleFieldChange = <T,>(setter: (val: T) => void) => (val: T) => {
    setter(val);
    setIsDirty(true);
    setSubmitError(null);
  };

  const handleGroupUpdated = (updated: TrainingGroup) => {
    setLoadedGroup((prev) => ({
      ...updated,
      metrics: prev?.metrics || null,
      currentCycle: prev?.currentCycle || null,
      summary: prev?.summary || null,
    }));
    if (updated.postDeadlinePolicy) setPostDeadlinePolicy(updated.postDeadlinePolicy);
    if (updated.enrollmentPolicy) setEnrollmentPolicy(updated.enrollmentPolicy);
    if (updated.maxTrainees !== undefined) {
      setMaxTrainees(updated.maxTrainees !== null ? String(updated.maxTrainees) : '');
    }
    if (updated.isEnrollmentOpen !== undefined) setIsEnrollmentOpen(updated.isEnrollmentOpen);
    if (updated.enrollmentExpiresAt !== undefined) {
      setEnrollmentExpiresAt(toDatetimeLocal(updated.enrollmentExpiresAt));
    }
  };

  // Staff assignment helpers
  const handlePrimaryInstructorChange = (newPrimaryId: string) => {
    setPrimaryInstructorId(newPrimaryId);
    if (newPrimaryId) {
      setAssistantLecturerIds((prev) =>
        prev.filter((aid) => aid.toLowerCase() !== newPrimaryId.toLowerCase())
      );
      if (selectedAssistantToAdd.toLowerCase() === newPrimaryId.toLowerCase()) {
        setSelectedAssistantToAdd('');
      }
    }
    setIsDirty(true);
    setSubmitError(null);
  };

  const handleAddAssistantLecturer = (lecturerIdToAdd?: string) => {
    const targetId = (lecturerIdToAdd ?? selectedAssistantToAdd).trim();
    if (!targetId) return;
    if (primaryInstructorId && targetId.toLowerCase() === primaryInstructorId.toLowerCase()) {
      return;
    }
    if (assistantLecturerIds.some((id) => id.toLowerCase() === targetId.toLowerCase())) {
      return;
    }
    setAssistantLecturerIds((prev) => [...prev, targetId]);
    setSelectedAssistantToAdd('');
    setIsDirty(true);
    setSubmitError(null);
  };

  const handleRemoveAssistantLecturer = (lecturerIdToRemove: string) => {
    setAssistantLecturerIds((prev) =>
      prev.filter((id) => id.toLowerCase() !== lecturerIdToRemove.toLowerCase())
    );
    setIsDirty(true);
    setSubmitError(null);
  };

  const selectedPrimaryLecturer = useMemo(
    () =>
      candidateLecturers.find(
        (l) => primaryInstructorId && l.id.toLowerCase() === primaryInstructorId.toLowerCase()
      ) || null,
    [candidateLecturers, primaryInstructorId]
  );

  const assignedAssistantLecturers = useMemo(
    () =>
      assistantLecturerIds.map((aid) => {
        const found = candidateLecturers.find((l) => l.id.toLowerCase() === aid.toLowerCase());
        if (found) return found;
        const fromGroup = loadedGroup?.instructors?.find(
          (i) => i.userId.toLowerCase() === aid.toLowerCase()
        );
        return {
          id: aid,
          name: fromGroup?.name || aid,
          username: aid,
          email: fromGroup?.email || '',
          jobTitle: fromGroup?.jobTitle || 'محاضر معتمد',
          department: fromGroup?.department || '',
          phone: fromGroup?.phone || undefined,
          status: 'active' as const,
        };
      }),
    [assistantLecturerIds, candidateLecturers, loadedGroup]
  );

  const availableAssistantLecturers = useMemo(() => {
    const q = lecturerSearchQuery.trim().toLowerCase();
    return candidateLecturers.filter((l) => {
      if (primaryInstructorId && l.id.toLowerCase() === primaryInstructorId.toLowerCase()) {
        return false;
      }
      if (assistantLecturerIds.some((aid) => aid.toLowerCase() === l.id.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.department.toLowerCase().includes(q) ||
        l.jobTitle.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
      );
    });
  }, [candidateLecturers, primaryInstructorId, assistantLecturerIds, lecturerSearchQuery]);

  // Validation
  const validateForm = (): { isValid: boolean; errs: Record<string, string> } => {
    const errs: Record<string, string> = {};

    if (!name.trim()) {
      errs.name = 'اسم المجموعة التدريبية مطلوب';
    } else if (name.trim().length < 3) {
      errs.name = 'اسم المجموعة يجب أن يتكون من 3 أحرف على الأقل';
    }

    if (!description.trim()) {
      errs.description = 'وصف المجموعة التدريبية مطلوب';
    } else if (description.trim().length < 5) {
      errs.description = 'الوصف يجب ألا يقل عن 5 أحرف';
    }

    if (!startDateTime) {
      errs.startDateTime = 'تاريخ بداية المجموعة مطلوب';
    }

    if (!deadlineDateTime) {
      errs.deadlineDateTime = 'الموعد النهائي للمجموعة مطلوب';
    }

    if (startDateTime && deadlineDateTime) {
      const startMs = new Date(startDateTime).getTime();
      const deadlineMs = new Date(deadlineDateTime).getTime();
      if (deadlineMs <= startMs) {
        errs.deadlineDateTime = 'الموعد النهائي يجب أن يكون لاحقاً لتاريخ البداية';
      }
    }

    if (maxTrainees && (isNaN(Number(maxTrainees)) || Number(maxTrainees) <= 0)) {
      errs.maxTrainees = 'سعة المتدربين يجب أن تكون رقماً موجباً';
    }

    if (autoRenewalEnabled) {
      const intervalVal = validateRenewalIntervalDays(renewalIntervalDays);
      if (!intervalVal.isValid) {
        errs.renewalIntervalDays = intervalVal.error || 'يرجى إدخال عدد أيام صالح لفترة التجديد';
      }
    }

    setErrors(errs);
    return { isValid: Object.keys(errs).length === 0, errs };
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid, errs } = validateForm();
    if (!isValid) {
      // Direct user to the tab containing the primary error if not currently active
      if (errs.name || errs.description) {
        if (activeTab !== 'general') handleTabSwitch('general');
      } else if (errs.startDateTime || errs.deadlineDateTime || errs.renewalIntervalDays) {
        if (activeTab !== 'schedule') handleTabSwitch('schedule');
      } else if (errs.maxTrainees) {
        if (activeTab !== 'members') handleTabSwitch('members');
      }
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const intervalNumber =
      autoRenewalEnabled && renewalIntervalDays.trim()
        ? parseInt(renewalIntervalDays.trim(), 10)
        : null;

    const derivedRecurrence: RecurrenceOption =
      !autoRenewalEnabled || intervalNumber === null
        ? 'none'
        : intervalNumber === 30
        ? 'monthly'
        : intervalNumber === 60
        ? 'bimonthly'
        : intervalNumber === 90
        ? 'quarterly'
        : 'custom';

    const computedNextRenewalIso =
      autoRenewalEnabled && intervalNumber && authoritativeRenewalDeadline
        ? calculateNextRenewalDateSafe(authoritativeRenewalDeadline, intervalNumber)
        : null;

    const payload = {
      name: name.trim(),
      description: description.trim(),
      startDateTime: toIsoString(startDateTime),
      deadlineDateTime: toIsoString(deadlineDateTime),
      postDeadlinePolicy,
      adminStatus,
      enrollmentPolicy,
      primaryInstructorId: primaryInstructorId ? primaryInstructorId : null,
      assistantLecturerIds,
      supervisorIds: [
        ...(primaryInstructorId ? [primaryInstructorId] : []),
        ...assistantLecturerIds,
      ],
      maxTrainees: maxTrainees ? Number(maxTrainees) : null,
      isEnrollmentOpen,
      enrollmentExpiresAt: enrollmentExpiresAt ? toIsoString(enrollmentExpiresAt) : null,
      renewalSchedule: {
        autoRenewalEnabled,
        intervalDays: intervalNumber,
        renewalIntervalDays: intervalNumber,
        nextScheduledRenewalDate: computedNextRenewalIso,
        recurrenceType: derivedRecurrence,
      },
    };

    try {
      if (isCreateMode && !loadedGroup) {
        const created = await groupsApi.createGroup(payload);
        toast.success(`تم إنشاء المجموعة التدريبية بنجاح: ${created.name}`);
        flushSync(() => {
          setIsDirty(false);
          setLoadedGroup(created as AdminEnrichedTrainingGroup);
        });
        navigate(
          `/admin/groups/${encodeURIComponent(created.id)}/edit${activeTab !== 'general' ? `?tab=${activeTab}` : ''}`,
          { replace: true }
        );
      } else if (loadedGroup || groupId) {
        const targetId = loadedGroup?.id || groupId!;
        const updated = await groupsApi.updateGroup(targetId, payload);
        setLoadedGroup((prev) => ({
          ...updated,
          metrics: prev?.metrics || null,
          currentCycle: prev?.currentCycle || null,
          summary: prev?.summary || null,
        }));
        toast.success('تم حفظ إعدادات المجموعة التدريبية بنجاح');
        setIsDirty(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ المجموعة';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (authLoading || loading) {
    return (
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="group-edit-loading"
        dir="rtl"
      >
        <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-2xl border border-border">
          <Icon name="clock" size="lg" className="animate-spin text-primary mb-4" />
          <p className="text-text-muted text-base font-medium">
            {isCreateMode
              ? 'جارٍ تهيئة نموذج المجموعة...'
              : 'جارٍ تحميل إعدادات المجموعة التدريبية...'}
          </p>
        </div>
      </div>
    );
  }

  // Unauthorized State (Non-admin trying to create or edit group settings)
  if (!isAuthenticated || !isAdmin) {
    return (
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="group-edit-unauthorized"
        dir="rtl"
      >
        <Alert variant="warning" title="صلاحية مقصورة على مديري النظام">
          <p className="text-sm mb-4">
            تكوين وتعديل إعدادات المجموعات التدريبية يتطلب صلاحيات مدير النظام الكاملة.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            العودة إلى لوحة المتابعة
          </Button>
        </Alert>
      </div>
    );
  }

  // Error / Not Found State in Edit Mode
  if (!isCreateMode && (loadError || !loadedGroup)) {
    return (
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
        data-testid="group-not-found"
        dir="rtl"
      >
        <Alert variant="danger" title="المجموعة التدريبية غير موجودة">
          <p className="text-sm mb-4">
            {loadError || 'تعذر العثور على المجموعة التدريبية المطلوبة أو قد تكون حُذفت.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/groups')}
              data-testid="back-to-groups-btn"
            >
              العودة إلى قائمة المجموعات
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchGroup}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8"
      data-testid="group-editor-page"
      dir="rtl"
    >
      {/* Unsaved Changes Guard Dialog */}
      {guardDialog}

      {/* Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-border">
        {/* Title and Breadcrumbs Area */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <button
              type="button"
              onClick={() => safeNavigate('/admin/groups')}
              className="hover:text-primary transition-colors cursor-pointer"
            >
              المجموعات التدريبية
            </button>
            <span>/</span>
            <span className="text-primary font-medium truncate max-w-xs sm:max-w-md">
              {isCreateMode ? 'إنشاء مجموعة جديدة' : loadedGroup?.name || 'تعديل المجموعة'}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading flex items-center gap-2.5 leading-tight">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon name={isCreateMode ? 'plus' : 'edit'} size="md" />
              </span>
              <span>
                {isCreateMode ? 'إنشاء مجموعة تدريبية جديدة' : `تعديل: ${loadedGroup?.name}`}
              </span>
            </h1>
            {!isCreateMode && loadedGroup && (
              <Badge variant="neutral" size="sm" className="font-mono text-xs font-semibold px-2 py-0.5">
                {loadedGroup.id}
              </Badge>
            )}
          </div>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center flex-wrap gap-2.5 shrink-0 self-start lg:self-center">
          {!isCreateMode && loadedGroup && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon="activity"
              onClick={() => safeNavigate(`/admin/groups/${encodeURIComponent(loadedGroup.id)}/monitoring`)}
              data-testid="go-to-monitoring-btn"
              className="font-bold text-xs"
            >
              متابعة المجموعة
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => safeNavigate('/admin/groups')}
            data-testid="cancel-group-btn"
            className="font-bold text-xs"
          >
            إلغاء والعودة
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit}
            data-testid="header-save-group-btn"
            className="font-bold text-xs"
          >
            {isCreateMode ? 'إنشاء وتفعيل المجموعة' : 'حفظ التعديلات'}
          </Button>
        </div>
      </div>

      {/* Workspace Tabs (Unified 7-Tab Strip Architecture) */}
      <div className="border-b border-border">
        <nav
          className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden -mb-px"
          aria-label="تبويبات إعدادات المجموعة"
        >
          <button
            type="button"
            onClick={() => handleTabSwitch('general')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'general'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-general-settings"
          >
            <Icon
              name="settings"
              size="sm"
              className={activeTab === 'general' ? 'text-primary' : 'text-text-muted'}
            />
            <span>البيانات الأساسية</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('schedule')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'schedule'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-schedule"
          >
            <Icon
              name="clock"
              size="sm"
              className={activeTab === 'schedule' ? 'text-primary' : 'text-text-muted'}
            />
            <span>مواقيت المجموعة</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('members')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'members'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-members"
          >
            <Icon
              name="user"
              size="sm"
              className={activeTab === 'members' ? 'text-primary' : 'text-text-muted'}
            />
            <span>المتدربون ورمز QR</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('courses')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'courses'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-courses"
          >
            <Icon
              name="courses"
              size="sm"
              className={activeTab === 'courses' ? 'text-primary' : 'text-text-muted'}
            />
            <span>المقررات التدريبية</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('materials')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'materials'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-materials"
          >
            <Icon
              name="folder"
              size="sm"
              className={activeTab === 'materials' ? 'text-primary' : 'text-text-muted'}
            />
            <span>حقيبة المواد</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('meetings')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'meetings'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-meetings"
          >
            <Icon
              name="video"
              size="sm"
              className={activeTab === 'meetings' ? 'text-primary' : 'text-text-muted'}
            />
            <span>اللقاءات التفاعلية والمواد المرفقة</span>
          </button>

          {!isCreateMode && loadedGroup && (
            <button
              type="button"
              onClick={() =>
                safeNavigate(`/admin/groups/${encodeURIComponent(loadedGroup.id)}/monitoring`)
              }
              className="px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none text-text-muted hover:text-primary hover:bg-primary/5 border-transparent"
              data-testid="tab-monitoring-link"
            >
              <Icon name="activity" size="sm" className="text-primary" />
              <span>متابعة المجموعة</span>
            </button>
          )}
        </nav>
      </div>

      {/* Submit Error Banner for Non-Form Tabs */}
      {submitError &&
        activeTab !== 'general' &&
        activeTab !== 'schedule' &&
        activeTab !== 'members' && (
          <Alert variant="danger" title="تعذر حفظ إعدادات المجموعة">
            <p className="text-sm">{submitError}</p>
          </Alert>
        )}

      {/* Tab Content */}
      {activeTab !== 'general' && activeTab !== 'schedule' && activeTab !== 'members' && !loadedGroup ? (
        <Card
          variant="default"
          className="p-8 sm:p-12 text-center border-dashed border-2 bg-surface space-y-4"
          data-testid="tab-dependency-notice"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Icon name="info" size="xl" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-text-heading">
              تتطلب هذه الخاصية حفظ المجموعة أولاً
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {activeTab === 'courses'
                ? 'لإسناد المقررات التدريبية وضبط المواعيد، يرجى ملء البيانات الأساسية وحفظ المجموعة أولاً.'
                : activeTab === 'materials'
                ? 'للوصول إلى مستكشف حقيبة المواد والمستندات، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'
                : 'لجدولة اللقاءات التفاعلية وإرفاق الأدلة والملفات العامة بالمجموعة، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleTabSwitch('general')}
              data-testid="return-to-general-tab-btn"
            >
              العودة للبيانات الأساسية
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              data-testid="save-and-continue-btn"
            >
              حفظ المجموعة والمتابعة
            </Button>
          </div>
        </Card>
      ) : activeTab === 'courses' && loadedGroup ? (
        <GroupCoursesTab
          group={loadedGroup}
          onGroupUpdated={handleGroupUpdated}
          postDeadlinePolicy={postDeadlinePolicy}
          onPostDeadlinePolicyChange={(val) => setPostDeadlinePolicy(val)}
        />
      ) : activeTab === 'materials' && loadedGroup ? (
        <GroupMaterialsTab groupId={loadedGroup.id} group={loadedGroup} />
      ) : activeTab === 'meetings' && loadedGroup ? (
        <div className="space-y-8" data-testid="group-meetings-and-attachments-tab">
          <section aria-label="اللقاءات التفاعلية" data-testid="unified-meetings-section">
            <GroupMeetingsTab
              groupId={loadedGroup.id}
              group={loadedGroup}
              onUpdateGroup={handleGroupUpdated}
            />
          </section>

          <div className="border-t border-border" role="separator" />

          <section aria-label="المواد المرفقة" data-testid="unified-attachments-section">
            <GroupAttachmentsTab
              groupId={loadedGroup.id}
              group={loadedGroup}
              onUpdateGroup={handleGroupUpdated}
            />
          </section>
        </div>
      ) : activeTab === 'members' ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Submit Error Banner */}
          {submitError && (
            <Alert variant="danger" title="تعذر حفظ إعدادات المجموعة">
              <p className="text-sm">{submitError}</p>
            </Alert>
          )}

          {/* Member Management or Dependency Notice */}
          {loadedGroup ? (
            <GroupMembersTab
              group={loadedGroup}
              onGroupUpdated={handleGroupUpdated}
              enrollmentPolicy={enrollmentPolicy}
              onEnrollmentPolicyChange={setEnrollmentPolicy}
              maxTrainees={maxTrainees}
              onMaxTraineesChange={setMaxTrainees}
              enrollmentExpiresAt={enrollmentExpiresAt}
              onEnrollmentExpiresAtChange={setEnrollmentExpiresAt}
              isEnrollmentOpen={isEnrollmentOpen}
              onIsEnrollmentOpenChange={setIsEnrollmentOpen}
              policyErrors={errors}
            />
          ) : (
            <Card
              variant="default"
              className="p-8 sm:p-12 text-center border-dashed border-2 bg-surface space-y-4"
              data-testid="tab-dependency-notice"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Icon name="info" size="xl" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-text-heading">
                  تتطلب هذه الخاصية حفظ المجموعة أولاً
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  لإدارة قائمة المتدربين وتوليد رمز الانضمام السريع QR، يرجى حفظ البيانات الأساسية للمجموعة أولاً.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTabSwitch('general')}
                  data-testid="return-to-general-tab-btn"
                >
                  العودة للبيانات الأساسية
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                  data-testid="save-and-continue-btn"
                >
                  حفظ المجموعة والمتابعة
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : activeTab === 'schedule' ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Submit Error Banner */}
          {submitError && (
            <Alert variant="danger" title="تعذر حفظ إعدادات المجموعة">
              <p className="text-sm">{submitError}</p>
            </Alert>
          )}

          {/* Schedule and Timings Form */}
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8" noValidate>
            {/* Section 1: Schedule & Deadline Dates */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="clock" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">الجدول الزمني العام ومواعيد الاستحقاق</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    تحديد تواريخ الانطلاق والانتهاء للمجموعة التدريبية
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <label htmlFor="group-start-input" className="block text-xs font-bold text-text">
                      تاريخ ووقت البداية العام <span className="text-danger">*</span>
                    </label>
                    <input
                      id="group-start-input"
                      type="datetime-local"
                      value={startDateTime}
                      onChange={(e) => handleFieldChange(setStartDateTime)(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm bg-bg border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                        errors.startDateTime ? 'border-danger' : 'border-border'
                      }`}
                      data-testid="group-start-input"
                    />
                    {errors.startDateTime && (
                      <span className="text-xs text-danger flex items-center gap-1 font-medium">
                        <Icon name="alert" size="sm" />
                        {errors.startDateTime}
                      </span>
                    )}
                  </div>

                  {/* Deadline Date */}
                  <div className="space-y-2">
                    <label htmlFor="group-deadline-input" className="block text-xs font-bold text-text">
                      الموعد النهائي العام للاستحقاق <span className="text-danger">*</span>
                    </label>
                    <input
                      id="group-deadline-input"
                      type="datetime-local"
                      value={deadlineDateTime}
                      onChange={(e) => handleFieldChange(setDeadlineDateTime)(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm bg-bg border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                        errors.deadlineDateTime ? 'border-danger' : 'border-border'
                      }`}
                      data-testid="group-deadline-input"
                    />
                    {errors.deadlineDateTime && (
                      <span className="text-xs text-danger flex items-center gap-1 font-medium">
                        <Icon name="alert" size="sm" />
                        {errors.deadlineDateTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 2: Renewal Schedule */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="refresh" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">جدول التجديد الدوري الآلي للمجموعة</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    إنشاء مجموعة تدريبية جديدة تلقائياً بعد انقضاء الفترة المحددة بالأيام من تاريخ انتهاء المجموعة الحالية
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-2xl">
                {/* Automatic Renewal Toggle */}
                <div className="flex items-center gap-3 bg-bg/60 p-4 rounded-xl border border-border">
                  <input
                    type="checkbox"
                    id="auto-renewal-toggle"
                    checked={autoRenewalEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      handleFieldChange(setAutoRenewalEnabled)(enabled);
                      if (enabled && !renewalIntervalDays) {
                        handleFieldChange(setRenewalIntervalDays)('30');
                      }
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
                    data-testid="auto-renewal-toggle"
                  />
                  <div>
                    <label
                      htmlFor="auto-renewal-toggle"
                      className="text-xs font-bold text-text cursor-pointer select-none block"
                    >
                      تفعيل التجديد الدوري الآلي للمجموعة التدريبية
                    </label>
                    <span className="text-[11px] text-text-muted block mt-0.5">
                      إنشاء مجموعة تدريبية جديدة تلقائياً بنفس المتدربين والمقررات عند حلول موعد الاستحقاق المجدول
                    </span>
                  </div>
                </div>

                {autoRenewalEnabled ? (
                  <div className="space-y-4 pr-1">
                    <p className="text-xs text-text-muted leading-relaxed">
                      حدد عدد الأيام الفاصلة بعد انتهاء المجموعة الحالية. يتم احتساب تاريخ بدء المجموعة الجديدة تلقائياً بإضافة عدد الأيام المحدد إلى تاريخ نهاية (الموعد النهائي) للمجموعة الحالية.
                    </p>

                    {/* Presets and Custom Input */}
                    <div className="space-y-2.5">
                      <label htmlFor="renewal-interval-days-input" className="block text-xs font-bold text-text">
                        فترة التجديد الدوري (بالأيام)
                      </label>

                      {/* Preset shortcuts */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-text-muted">خيارات سريعة:</span>
                        {[30, 60, 90].map((preset) => {
                          const isSelected = renewalIntervalDays === String(preset);
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleFieldChange(setRenewalIntervalDays)(String(preset))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-bg text-text hover:bg-neutral-light border-border'
                              }`}
                              data-testid={`preset-interval-${preset}`}
                            >
                              {preset} يوماً
                            </button>
                          );
                        })}
                      </div>

                      {/* Manual numeric input */}
                      <div className="max-w-xs mt-2">
                        <input
                          id="renewal-interval-days-input"
                          type="number"
                          min="1"
                          max="730"
                          step="1"
                          value={renewalIntervalDays}
                          onChange={(e) => handleFieldChange(setRenewalIntervalDays)(e.target.value)}
                          placeholder="مثال: 17، 30، 45، 60، 90، 120"
                          className={`w-full px-3.5 py-2.5 text-sm bg-bg border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                            errors.renewalIntervalDays ? 'border-danger focus:ring-danger' : 'border-border'
                          }`}
                          data-testid="renewal-interval-days-input"
                        />
                        {errors.renewalIntervalDays && (
                          <p className="text-[11px] text-danger mt-1 font-medium" data-testid="renewal-interval-error">
                            {errors.renewalIntervalDays}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Calculated Next Renewal Date Live Preview */}
                    {calculatedNextRenewalPreview && (
                      <div
                        className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center gap-3 text-xs"
                        data-testid="calculated-next-renewal-date-preview"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon name="calendar" size="sm" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-text">
                            تاريخ التجديد الآلي القادم المحتسب:
                            <span className="text-primary font-bold mr-1.5 underline decoration-primary/40 underline-offset-4">
                              {calculatedNextRenewalPreview}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted">
                            محسوب من تاريخ نهاية المجموعة التدريبية بإضافة {renewalIntervalDays} يوماً تقويمياً.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted leading-relaxed bg-neutral-light/40 p-3 rounded-xl border border-border/50">
                    التجديد الدوري الآلي معطل حالياً. عند تفعيله، يقوم النظام تلقائياً بإنشاء مجموعة جديدة بعد انقضاء الفترة المحددة من الموعد النهائي مع أرشفة المجموعة السابقة والحفاظ على سجلاتها التاريخية.
                  </p>
                )}
              </div>
            </Card>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => safeNavigate('/admin/groups')}
                disabled={isSubmitting}
                className="font-bold text-xs"
              >
                إلغاء والعودة
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                data-testid="save-group-btn"
                className="font-bold text-xs"
              >
                {isCreateMode ? 'إنشاء وتفعيل المجموعة' : 'حفظ التعديلات'}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* activeTab === 'general' */
        <div className="space-y-6 sm:space-y-8">
          {/* Submit Error Banner */}
          {submitError && (
            <Alert variant="danger" title="تعذر حفظ إعدادات المجموعة">
              <p className="text-sm">{submitError}</p>
            </Alert>
          )}

          {/* Basic Information Form */}
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8" noValidate>
            {/* Section 1: Basic Information */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="info" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">البيانات الأساسية للمجموعة</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    اسم المجموعة ووصف البرنامج التدريبي وحالة تفعيلها في النظام
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Group Name */}
                <div>
                  <FormInput
                    label="اسم المجموعة التدريبية"
                    required
                    value={name}
                    onChange={(e) => handleFieldChange(setName)(e.target.value)}
                    placeholder="مثال: برنامج تشغيل وتأمين الحركة — الدفعة 43"
                    error={errors.name}
                    id="group-name-input"
                    data-testid="group-name-input"
                  />
                </div>

                {/* Group Description */}
                <div className="space-y-2">
                  <label htmlFor="group-desc-input" className="block text-xs font-bold text-text">
                    وصف البرنامج التدريبي والجمهور المستهدف <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="group-desc-input"
                    rows={3}
                    value={description}
                    onChange={(e) => handleFieldChange(setDescription)(e.target.value)}
                    placeholder="أدخل وصفاً تفصيلياً للأهداف التشغيلية والفئات المستهدفة من هذه الدفعة التدريبية..."
                    className={`w-full px-4 py-3 text-sm bg-bg border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none ${
                      errors.description ? 'border-danger' : 'border-border'
                    }`}
                    data-testid="group-desc-input"
                  />
                  {errors.description && (
                    <span className="text-xs text-danger flex items-center gap-1 font-medium">
                      <Icon name="alert" size="sm" />
                      {errors.description}
                    </span>
                  )}
                </div>

                {/* Lifecycle Admin Status */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <div>
                    <label className="block text-xs font-bold text-text">
                      حالة تفعيل المجموعة في النظام
                    </label>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      حدد ما إذا كانت المجموعة جاهزة للتشغيل واستقبال المتدربين أو مسودة تحت الإعداد
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-lg">
                    {[
                      {
                        id: 'active',
                        title: 'نشطة ومفعلة',
                        desc: 'تظهر في جداول المتابعة والتشغيل وتقبل التدريب',
                      },
                      {
                        id: 'draft',
                        title: 'مسودة قيد الإعداد',
                        desc: 'قيد التجهيز ولا تظهر للمتدربين',
                      },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleFieldChange(setAdminStatus)(s.id as GroupAdminStatus)}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                          adminStatus === s.id
                            ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                            : 'border-border bg-bg text-text-muted hover:bg-neutral-light hover:text-text'
                        }`}
                        data-testid={`admin-status-${s.id}`}
                      >
                        <div className="font-bold text-xs">{s.title}</div>
                        <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 2: Training & Supervision Staff (طاقم التدريب والإشراف) */}
            <Card
              className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6"
              data-testid="group-staff-section"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="user" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">طاقم التدريب والإشراف</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    تعيين المحاضر الأساسي والمحاضرين المساعدين للمجموعة التدريبية من حسابات المحاضرين المعتمدة
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* 1. Primary Instructor Selection */}
                <div className="space-y-3">
                  <label
                    htmlFor="primary-instructor-select"
                    className="block text-xs font-bold text-text"
                  >
                    المحاضر الأساسي للمجموعة
                  </label>
                  <select
                    id="primary-instructor-select"
                    value={primaryInstructorId}
                    onChange={(e) => handlePrimaryInstructorChange(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    data-testid="primary-instructor-select"
                  >
                    <option value="">— بدون محاضر أساسي محدد حالياً —</option>
                    {candidateLecturers.map((lec) => (
                      <option key={lec.id} value={lec.id}>
                        {lec.name} — {lec.jobTitle} ({lec.department})
                      </option>
                    ))}
                  </select>

                  {selectedPrimaryLecturer ? (
                    <div
                      className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5"
                      data-testid="assigned-primary-instructor-card"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                          {selectedPrimaryLecturer.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-text-heading truncate">
                              {selectedPrimaryLecturer.name}
                            </span>
                            <Badge variant="primary" size="sm">
                              المحاضر الأساسي
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted truncate mt-0.5">
                            {selectedPrimaryLecturer.jobTitle} • {selectedPrimaryLecturer.department}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrimaryInstructorChange('')}
                        data-testid="clear-primary-instructor-btn"
                        className="text-xs text-danger hover:text-danger shrink-0"
                      >
                        إلغاء التعيين
                      </Button>
                    </div>
                  ) : (
                    <p
                      className="text-xs text-text-muted bg-neutral-light/40 border border-border/60 rounded-xl px-3.5 py-2.5"
                      data-testid="no-primary-instructor-notice"
                    >
                      لم يتم تعيين محاضر أساسي لهذه المجموعة بعد. اختر محاضراً من القائمة أعلاه.
                    </p>
                  )}
                </div>

                {/* 2. Assistant Lecturers Assignment */}
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <label
                        htmlFor="assistant-lecturer-select"
                        className="block text-xs font-bold text-text"
                      >
                        المحاضرون المساعدون
                      </label>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        يمكنك إسناد محاضر مساعد أو أكثر لمعاونة المحاضر الأساسي في متابعة المتدربين وإدارة محتوى المجموعة
                      </p>
                    </div>
                    <Badge variant="neutral" size="sm">
                      {assignedAssistantLecturers.length} محاضر مساعد
                    </Badge>
                  </div>

                  {/* Search & Select to Add Assistant Lecturer */}
                  <div className="space-y-2.5">
                    {candidateLecturers.length > 3 && (
                      <input
                        type="search"
                        value={lecturerSearchQuery}
                        onChange={(e) => setLecturerSearchQuery(e.target.value)}
                        placeholder="ابحث عن محاضر بالاسم أو الإدارة..."
                        className="w-full px-3.5 py-2 text-xs bg-bg border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
                        data-testid="assistant-lecturer-search-input"
                      />
                    )}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <select
                        id="assistant-lecturer-select"
                        value={selectedAssistantToAdd}
                        onChange={(e) => setSelectedAssistantToAdd(e.target.value)}
                        className="flex-1 px-4 py-2.5 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        data-testid="assistant-lecturer-select"
                      >
                        <option value="">
                          {availableAssistantLecturers.length > 0
                            ? '— اختر محاضراً مساعداً لإضافته —'
                            : '— لا يوجد محاضرون إضافيون متاحون للاختيار —'}
                        </option>
                        {availableAssistantLecturers.map((lec) => (
                          <option key={lec.id} value={lec.id}>
                            {lec.name} — {lec.jobTitle} ({lec.department})
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon="plus"
                        disabled={!selectedAssistantToAdd}
                        onClick={() => handleAddAssistantLecturer()}
                        data-testid="add-assistant-lecturer-btn"
                        className="font-bold text-xs shrink-0"
                      >
                        إضافة محاضر مساعد
                      </Button>
                    </div>
                  </div>

                  {/* Currently Assigned Assistant Lecturers List */}
                  {assignedAssistantLecturers.length > 0 ? (
                    <div
                      className="space-y-2.5 pt-1"
                      data-testid="assigned-assistant-lecturers-list"
                    >
                      {assignedAssistantLecturers.map((assistant) => (
                        <div
                          key={assistant.id}
                          className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-bg"
                          data-testid={`assigned-assistant-card-${assistant.id}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0 font-bold text-xs">
                              {assistant.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-text-heading truncate">
                                  {assistant.name}
                                </span>
                                <Badge variant="info" size="sm">
                                  المحاضر المساعد
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted truncate mt-0.5">
                                {assistant.jobTitle}
                                {assistant.department ? ` • ${assistant.department}` : ''}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAssistantLecturer(assistant.id)}
                            data-testid={`remove-assistant-lecturer-${assistant.id}`}
                            className="text-xs text-danger hover:text-danger shrink-0"
                          >
                            إزالة
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      className="text-xs text-text-muted bg-neutral-light/40 border border-border/60 rounded-xl px-3.5 py-2.5"
                      data-testid="no-assistant-lecturers-notice"
                    >
                      لا يوجد محاضرون مساعدون مسندون لهذه المجموعة حالياً.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => safeNavigate('/admin/groups')}
                disabled={isSubmitting}
                className="font-bold text-xs"
              >
                إلغاء والعودة
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                data-testid="save-group-btn"
                className="font-bold text-xs"
              >
                {isCreateMode ? 'إنشاء وتفعيل المجموعة' : 'حفظ التعديلات'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default GroupEditorPage;
