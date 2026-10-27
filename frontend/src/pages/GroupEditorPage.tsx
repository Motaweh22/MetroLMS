import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { groupsApi } from '@/features/groups/services/groupsApi';
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
  | 'courses'
  | 'members'
  | 'materials'
  | 'attachments'
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
    tabParam === 'courses'
      ? 'courses'
      : tabParam === 'members'
      ? 'members'
      : tabParam === 'materials'
      ? 'materials'
      : tabParam === 'attachments'
      ? 'attachments'
      : tabParam === 'meetings'
      ? 'meetings'
      : 'general'
  );

  useEffect(() => {
    if (tabParam === 'courses') {
      setActiveTabState('courses');
    } else if (tabParam === 'members') {
      setActiveTabState('members');
    } else if (tabParam === 'materials') {
      setActiveTabState('materials');
    } else if (tabParam === 'attachments') {
      setActiveTabState('attachments');
    } else if (tabParam === 'meetings') {
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

  const isAdmin = user?.role === 'admin';

  // Loaded group in Edit mode
  const [loadedGroup, setLoadedGroup] = useState<TrainingGroup | null>(null);
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

  // Live calculated preview of next renewal date based on anchor (startDateTime) + N calendar days
  const calculatedNextRenewalPreview = useMemo(() => {
    if (!autoRenewalEnabled || !renewalIntervalDays || !startDateTime) return null;
    const nextDateIso = calculateNextRenewalDateSafe(startDateTime, renewalIntervalDays);
    if (!nextDateIso) return null;
    return formatArabicDate(nextDateIso);
  }, [autoRenewalEnabled, renewalIntervalDays, startDateTime]);

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

  // Validation
  const validateForm = (): boolean => {
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
    return Object.keys(errs).length === 0;
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

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

    const payload = {
      name: name.trim(),
      description: description.trim(),
      startDateTime: toIsoString(startDateTime),
      deadlineDateTime: toIsoString(deadlineDateTime),
      postDeadlinePolicy,
      adminStatus,
      enrollmentPolicy,
      maxTrainees: maxTrainees ? Number(maxTrainees) : null,
      isEnrollmentOpen,
      enrollmentExpiresAt: enrollmentExpiresAt ? toIsoString(enrollmentExpiresAt) : null,
      renewalSchedule: {
        autoRenewalEnabled,
        intervalDays: intervalNumber,
        renewalIntervalDays: intervalNumber,
        recurrenceType: derivedRecurrence,
      },
    };

    try {
      if (isCreateMode && !loadedGroup) {
        const created = await groupsApi.createGroup(payload);
        toast.success(`تم إنشاء المجموعة التدريبية بنجاح: ${created.name}`);
        flushSync(() => {
          setIsDirty(false);
          setLoadedGroup(created);
        });
        navigate(
          `/admin/groups/${encodeURIComponent(created.id)}/edit${activeTab !== 'general' ? `?tab=${activeTab}` : ''}`,
          { replace: true }
        );
      } else if (loadedGroup || groupId) {
        const targetId = loadedGroup?.id || groupId!;
        const updated = await groupsApi.updateGroup(targetId, payload);
        setLoadedGroup(updated);
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
              لوحة المتابعة
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
          {activeTab === 'general' && (
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
          )}
        </div>
      </div>

      {/* Workspace Tabs (Unified 6-Tab Strip Architecture) */}
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
            onClick={() => handleTabSwitch('attachments')}
            className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 border-b-2 rounded-t-lg select-none ${
              activeTab === 'attachments'
                ? 'text-primary border-primary bg-primary/5 shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-neutral-light/60 border-transparent'
            }`}
            data-testid="tab-attachments"
          >
            <Icon
              name="attachment"
              size="sm"
              className={activeTab === 'attachments' ? 'text-primary' : 'text-text-muted'}
            />
            <span>المواد المرفقة</span>
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
            <span>اللقاءات التفاعلية</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab !== 'general' && !loadedGroup ? (
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
                : activeTab === 'members'
                ? 'لإدارة قائمة المتدربين وتوليد رمز الانضمام السريع QR، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'
                : activeTab === 'materials'
                ? 'للوصول إلى مستكشف حقيبة المواد والمستندات، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'
                : activeTab === 'attachments'
                ? 'لإرفاق الأدلة والملفات العامة بالمجموعة، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'
                : 'لجدولة اللقاءات التفاعلية وجلسات Microsoft Teams، يرجى حفظ البيانات الأساسية للمجموعة أولاً.'}
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
        <GroupCoursesTab group={loadedGroup} onGroupUpdated={setLoadedGroup} />
      ) : activeTab === 'members' && loadedGroup ? (
        <GroupMembersTab group={loadedGroup} onGroupUpdated={setLoadedGroup} />
      ) : activeTab === 'materials' && loadedGroup ? (
        <GroupMaterialsTab groupId={loadedGroup.id} group={loadedGroup} />
      ) : activeTab === 'attachments' && loadedGroup ? (
        <GroupAttachmentsTab groupId={loadedGroup.id} group={loadedGroup} onUpdateGroup={setLoadedGroup} />
      ) : activeTab === 'meetings' && loadedGroup ? (
        <GroupMeetingsTab groupId={loadedGroup.id} group={loadedGroup} onUpdateGroup={setLoadedGroup} />
      ) : (
        <>
          {/* Submit Error Banner */}
          {submitError && (
            <Alert variant="danger" title="تعذر حفظ إعدادات المجموعة">
              <p className="text-sm">{submitError}</p>
            </Alert>
          )}

          {/* Main Form */}
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

            {/* Section 2: Schedule & Deadline Policies */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="clock" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">الجدول الزمني العام ومواعيد الاستحقاق</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    تحديد تواريخ الانطلاق والانتهاء وسياسة الوصول للمحتوى بعد الموعد النهائي
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

                {/* Post-deadline Policy */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <div>
                    <label className="block text-xs font-bold text-text">
                      سياسة التعامل مع المحتوى بعد انتهاء الموعد النهائي
                    </label>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      تحدد ما إذا كان للمتدرب الحق في مراجعة الدروس بعد انتهاء الفترة التدريبية
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {[
                      {
                        id: 'keep_no_cert',
                        title: 'إتاحة المحتوى بدون شهادة (الموصى به)',
                        desc: 'يبقى المحتوى متاحاً للمطالعة والمراجعة ولا تُمنح شهادة اجتياز جديدة',
                      },
                      {
                        id: 'hide',
                        title: 'إخفاء المحتوى تماماً',
                        desc: 'يُحجب المحتوى التدريبي ويختفي من قائمة الدورات لدى المتدرب فور انتهاء الموعد',
                      },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleFieldChange(setPostDeadlinePolicy)(p.id as PostDeadlinePolicy)}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                          postDeadlinePolicy === p.id
                            ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                            : 'border-border bg-bg text-text-muted hover:bg-neutral-light hover:text-text'
                        }`}
                        data-testid={`post-deadline-${p.id}`}
                      >
                        <div className="font-bold text-xs">{p.title}</div>
                        <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Section 3: Enrollment Policy & Capacity */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="user" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">سياسة الانضمام وسعة المجموعة</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    قواعد قبول المتدربين والحد الأقصى للسعة وصلاحية رمز الانضمام السريع
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Enrollment Policy */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-text">
                    سياسة قبول المتدربين في المجموعة
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {[
                      {
                        id: 'open',
                        title: 'انضمام تلقائي مفتوح',
                        desc: 'ينضم المتدرب فور مسح رمز الاستجابة السريعة QR',
                      },
                      {
                        id: 'approval_required',
                        title: 'موافقة المشرف مطلوبة',
                        desc: 'يُرسل المتدرب طلباً وينتظر اعتماد مشرف المجموعة',
                      },
                      {
                        id: 'closed',
                        title: 'انضمام مغلق / تعيين مباشر',
                        desc: 'لا يُسمح بالانضمام الذاتي وتقتصر الإضافة على الإدارة',
                      },
                    ].map((pol) => (
                      <button
                        key={pol.id}
                        type="button"
                        onClick={() => handleFieldChange(setEnrollmentPolicy)(pol.id as GroupEnrollmentPolicy)}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                          enrollmentPolicy === pol.id
                            ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                            : 'border-border bg-bg text-text-muted hover:bg-neutral-light hover:text-text'
                        }`}
                        data-testid={`enrollment-policy-${pol.id}`}
                      >
                        <div className="font-bold text-xs">{pol.title}</div>
                        <div className="text-[11px] text-text-muted mt-1 leading-relaxed">{pol.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-border/60">
                  {/* Max Trainees Capacity */}
                  <div>
                    <FormInput
                      label="الحد الأقصى لعدد المتدربين (السعة القصوى)"
                      type="number"
                      min="1"
                      value={maxTrainees}
                      onChange={(e) => handleFieldChange(setMaxTrainees)(e.target.value)}
                      placeholder="اتركه فارغاً لسعة غير محدودة"
                      helperText="يمنع النظام التسجيل الإضافي تلقائياً عند بلوغ السعة"
                      error={errors.maxTrainees}
                      id="group-capacity-input"
                      data-testid="group-capacity-input"
                    />
                  </div>

                  {/* Token Expiration */}
                  <div className="space-y-2">
                    <label htmlFor="group-token-expiry" className="block text-xs font-bold text-text">
                      تاريخ انتهاء صلاحية رمز الانضمام (اختياري)
                    </label>
                    <input
                      id="group-token-expiry"
                      type="datetime-local"
                      value={enrollmentExpiresAt}
                      onChange={(e) => handleFieldChange(setEnrollmentExpiresAt)(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      data-testid="group-token-expiry"
                    />
                    <span className="text-[11px] text-text-muted block">
                      يُلغى قبول الرمز تلقائياً بعد هذا التاريخ
                    </span>
                  </div>
                </div>

                {/* Master Open/Close Toggle */}
                <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                  <input
                    type="checkbox"
                    id="enrollment-open-toggle"
                    checked={isEnrollmentOpen}
                    onChange={(e) => handleFieldChange(setIsEnrollmentOpen)(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
                    data-testid="enrollment-open-toggle"
                  />
                  <label
                    htmlFor="enrollment-open-toggle"
                    className="text-xs font-medium text-text cursor-pointer select-none"
                  >
                    فتح استقبال طلبات الانضمام فوراً عبر رمز الاستجابة السريعة QR
                  </label>
                </div>
              </div>
            </Card>

            {/* Section 4: Renewal Schedule */}
            <Card className="p-6 sm:p-7 bg-surface border border-border rounded-2xl shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="refresh" size="md" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-heading">جدول دورات التجديد الدوري للمجموعة</h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    تحديد نمط تكرار الدورات التدريبية بفترة محددة بالأيام وتتبع سجلات المتدربين لكل دورة
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
                      إنشاء دورة تجديد تدريبي جديدة تلقائياً عند حلول موعد الاستحقاق المجدول
                    </span>
                  </div>
                </div>

                {autoRenewalEnabled ? (
                  <div className="space-y-4 pr-1">
                    <p className="text-xs text-text-muted leading-relaxed">
                      حدد عدد الأيام الفاصلة بين دورات التجديد الآلية. يتم احتساب تاريخ بدء الدورة الجديدة تلقائياً بإضافة عدد الأيام المحدد إلى تاريخ بداية الدورة التدريبية الحالية (تاريخ البداية + N يوم).
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
                            محسوب من تاريخ بداية الدورة بإضافة {renewalIntervalDays} يوماً تقويمياً.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-text-muted leading-relaxed bg-neutral-light/40 p-3 rounded-xl border border-border/50">
                    التجديد الدوري الآلي معطل حالياً. يمكنك بدء دورات التجديد يدوياً في أي وقت من تبويب المقررات التدريبية، مع الحفاظ الكامل على سجل المحاولات وتاريخ الإنجاز.
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
    </>
  )}
</div>
  );
};

export default GroupEditorPage;
