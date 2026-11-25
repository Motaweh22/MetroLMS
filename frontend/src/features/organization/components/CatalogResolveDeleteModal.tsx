import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/core/api/apiClient';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { StyledSelect } from '@/shared/ui/StyledSelect';
import { useToast } from '@/shared/ui/Toast';

export type OrganizationCatalogSlug =
  | 'departments'
  | 'job-titles'
  | 'leadership-titles'
  | 'metro-lines';

export interface CatalogItemOption {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  departmentId?: number | null;
}

export interface LinkedUserDependency {
  id: string;
  name: string;
  employeeNumber: string;
  role: string;
  department: string;
  jobTitle: string;
  metroLine: string;
  leadershipTitle: string;
  canModify: boolean;
}

export interface LinkedJobTitleDependency {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  isPrimaryScoped: boolean;
  hasDepartmentLink: boolean;
  linkedUsersCount: number;
}

export interface LinkedCourseDependency {
  id: number;
  title: string;
  lifecycleStatus: string;
}

export interface CatalogDependenciesResponse {
  catalog: OrganizationCatalogSlug;
  item: {
    id: number;
    nameAr: string;
    nameEn?: string | null;
  };
  supportsUnassign: boolean;
  users: LinkedUserDependency[];
  jobTitles: LinkedJobTitleDependency[];
  courses: LinkedCourseDependency[];
  hasProtectedUsers: boolean;
  canDeleteDirectly: boolean;
}

interface ResolveDependenciesResponse {
  updatedUsersCount: number;
  updatedJobTitlesCount: number;
  updatedCoursesCount: number;
  deleted: boolean;
  deleteBlockedReason: string | null;
  dependencies: CatalogDependenciesResponse | null;
}

interface CatalogResolveDeleteModalProps {
  isOpen: boolean;
  catalog: OrganizationCatalogSlug;
  singularLabel: string;
  dependencies: CatalogDependenciesResponse | null;
  alternativeItems: CatalogItemOption[];
  allJobTitles?: CatalogItemOption[];
  allDepartments?: CatalogItemOption[];
  onClose: () => void;
  onResolved: (deleted: boolean, itemId: number) => Promise<void> | void;
}

const ROLE_AR: Record<string, string> = {
  developer: 'مطور النظام',
  super_admin: 'المسؤول الأعلى',
  admin: 'مدير النظام',
  assistant_admin: 'مساعد إداري',
  lecturer: 'محاضر',
  user: 'متدرب',
};

export const CatalogResolveDeleteModal: React.FC<CatalogResolveDeleteModalProps> = ({
  isOpen,
  catalog,
  singularLabel,
  dependencies,
  alternativeItems,
  allJobTitles = [],
  allDepartments = [],
  onClose,
  onResolved,
}) => {
  const toast = useToast();
  const [currentDeps, setCurrentDeps] = useState<CatalogDependenciesResponse | null>(dependencies);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userAction, setUserAction] = useState<'transfer' | 'unassign' | 'none'>('transfer');
  const [targetId, setTargetId] = useState<string>('');
  const [targetJobTitleId, setTargetJobTitleId] = useState<string>('');

  const [selectedJobTitleIds, setSelectedJobTitleIds] = useState<number[]>([]);
  const [jobTitleAction, setJobTitleAction] = useState<'make_global' | 'transfer' | 'none'>('make_global');
  const [targetJobDeptId, setTargetJobDeptId] = useState<string>('');

  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [courseAction, setCourseAction] = useState<'remove' | 'replace' | 'none'>('remove');
  const [targetCourseReplId, setTargetCourseReplId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const otherAlternatives = useMemo(
    () => alternativeItems.filter((alt) => alt.id !== currentDeps?.item.id),
    [alternativeItems, currentDeps?.item.id]
  );

  const otherDepartments = useMemo(
    () => allDepartments.filter((d) => d.id !== currentDeps?.item.id),
    [allDepartments, currentDeps?.item.id]
  );

  useEffect(() => {
    setCurrentDeps(dependencies);
    setSubmitError(null);
    setUserSearch('');
    if (!dependencies) return;

    const modifiableIds = dependencies.users.filter((u) => u.canModify).map((u) => u.id);
    setSelectedUserIds(modifiableIds);
    const alts = alternativeItems.filter((a) => a.id !== dependencies.item.id);
    const firstAltId = alts[0] ? String(alts[0].id) : '';
    setTargetId(firstAltId);
    setTargetJobTitleId('');

    if (modifiableIds.length > 0) {
      setUserAction(alts.length > 0 ? 'transfer' : dependencies.supportsUnassign ? 'unassign' : 'none');
    } else {
      setUserAction('none');
    }

    setSelectedJobTitleIds(dependencies.jobTitles.map((j) => j.id));
    setJobTitleAction(dependencies.jobTitles.length > 0 ? 'make_global' : 'none');
    const otherDepts = allDepartments.filter((d) => d.id !== dependencies.item.id);
    setTargetJobDeptId(otherDepts[0] ? String(otherDepts[0].id) : firstAltId);

    setSelectedCourseIds(dependencies.courses.map((c) => c.id));
    setCourseAction(dependencies.courses.length > 0 ? 'remove' : 'none');
    setTargetCourseReplId(firstAltId);
  }, [dependencies, alternativeItems, allDepartments]);

  const filteredUsers = useMemo(() => {
    if (!currentDeps) return [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return currentDeps.users;
    return currentDeps.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.employeeNumber || '').toLowerCase().includes(q) ||
        (u.jobTitle || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
    );
  }, [currentDeps, userSearch]);

  const modifiableFilteredUsers = useMemo(
    () => filteredUsers.filter((u) => u.canModify),
    [filteredUsers]
  );

  const allModifiableFilteredSelected =
    modifiableFilteredUsers.length > 0 &&
    modifiableFilteredUsers.every((u) => selectedUserIds.includes(u.id));

  const targetDeptScopedJobTitles = useMemo(() => {
    if (catalog !== 'departments' || !targetId) return [];
    return allJobTitles.filter(
      (jt) => jt.departmentId == null || String(jt.departmentId) === targetId
    );
  }, [catalog, targetId, allJobTitles]);

  if (!currentDeps) return null;

  const toggleAllVisibleUsers = () => {
    if (allModifiableFilteredSelected) {
      const visibleSet = new Set(modifiableFilteredUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      const merged = new Set(selectedUserIds);
      for (const u of modifiableFilteredUsers) merged.add(u.id);
      setSelectedUserIds(Array.from(merged));
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleJobTitle = (jtId: number) => {
    setSelectedJobTitleIds((prev) =>
      prev.includes(jtId) ? prev.filter((id) => id !== jtId) : [...prev, jtId]
    );
  };

  const toggleCourse = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = async (deleteAfter: boolean) => {
    setSubmitError(null);

    if (currentDeps.users.length > 0 && userAction !== 'none' && selectedUserIds.length > 0) {
      if (userAction === 'transfer' && !targetId) {
        setSubmitError('يرجى اختيار وجهة بديلة لنقل المستخدمين المحددين إليها.');
        return;
      }
    }
    if (
      catalog === 'departments' &&
      currentDeps.jobTitles.length > 0 &&
      jobTitleAction === 'transfer' &&
      selectedJobTitleIds.length > 0 &&
      !targetJobDeptId
    ) {
      setSubmitError('يرجى اختيار إدارة بديلة لنقل المسميات الوظيفية إليها.');
      return;
    }
    if (
      currentDeps.courses.length > 0 &&
      courseAction === 'replace' &&
      selectedCourseIds.length > 0 &&
      !targetCourseReplId
    ) {
      setSubmitError('يرجى اختيار عنصر بديل لاستهداف الدورات المحددة.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient<ResolveDependenciesResponse>(
        `/api/admin/organization/${catalog}/${currentDeps.item.id}/resolve-dependencies`,
        {
          method: 'POST',
          body: JSON.stringify({
            userAction: selectedUserIds.length > 0 ? userAction : 'none',
            userIds: selectedUserIds.map((id) => Number(id)),
            targetId: userAction === 'transfer' && targetId ? Number(targetId) : null,
            targetJobTitleId:
              catalog === 'departments' && userAction === 'transfer' && targetJobTitleId
                ? Number(targetJobTitleId)
                : null,
            jobTitleAction:
              catalog === 'departments' && selectedJobTitleIds.length > 0 ? jobTitleAction : 'none',
            jobTitleIds: selectedJobTitleIds,
            targetJobDepartmentId:
              jobTitleAction === 'transfer' && targetJobDeptId ? Number(targetJobDeptId) : null,
            courseAction: selectedCourseIds.length > 0 ? courseAction : 'none',
            courseIds: selectedCourseIds,
            targetCourseReplacementId:
              courseAction === 'replace' && targetCourseReplId ? Number(targetCourseReplId) : null,
            deleteAfter,
          }),
        }
      );

      if (res.deleted) {
        toast.success(`تمت معالجة الارتباطات وحذف "${currentDeps.item.nameAr}" بنجاح.`);
        await onResolved(true, currentDeps.item.id);
        onClose();
        return;
      }

      if (res.dependencies) {
        setCurrentDeps(res.dependencies);
        setSelectedUserIds(res.dependencies.users.filter((u) => u.canModify).map((u) => u.id));
        setSelectedJobTitleIds(res.dependencies.jobTitles.map((j) => j.id));
        setSelectedCourseIds(res.dependencies.courses.map((c) => c.id));
      }

      const changesCount =
        (res.updatedUsersCount || 0) +
        (res.updatedJobTitlesCount || 0) +
        (res.updatedCoursesCount || 0);
      if (changesCount > 0) {
        toast.success(
          `تم تحديث ${res.updatedUsersCount} مستخدم، ${res.updatedJobTitlesCount} مسمى وظيفي، و${res.updatedCoursesCount} دورة.`
        );
      }

      if (deleteAfter && res.deleteBlockedReason) {
        setSubmitError(res.deleteBlockedReason);
      } else if (res.dependencies?.canDeleteDirectly) {
        toast.info('تم تفريغ كافة العوائق. يمكنك الآن تأكيد الحذف النهائي.');
      }

      await onResolved(false, currentDeps.item.id);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'تعذر تنفيذ معالجة الارتباطات.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unassignLabel =
    catalog === 'departments'
      ? 'تحويل المحددين إلى «بدون قطاع»'
      : catalog === 'job-titles'
      ? 'تحويل المحددين إلى «بدون مسمى وظيفي»'
      : 'إزالة الصفة القيادية عن المحددين';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title={`معالجة ارتباطات وحذف ${singularLabel}: ${currentDeps.item.nameAr}`}
      description="هذا العنصر مرتبط بسجلات حالية. اختر الأشخاص والبيانات التي تريد نقلها أو فك ارتباطها لإتمام الحذف بأمان."
      size="xl"
      dataTestId="catalog-resolve-delete-modal"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
          >
            إغلاق
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {!currentDeps.canDeleteDirectly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isSubmitting}
                disabled={isSubmitting}
                data-testid="resolve-apply-partial-btn"
                onClick={() => handleSubmit(false)}
              >
                <Icon name="check" size="sm" className="ml-1" />
                تطبيق على المحددين فقط
              </Button>
            )}
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              data-testid="resolve-and-delete-btn"
              onClick={() => handleSubmit(true)}
            >
              <Icon name="trash" size="sm" className="ml-1" />
              {currentDeps.canDeleteDirectly
                ? 'تأكيد الحذف النهائي الآن'
                : 'تطبيق المعالجة وحذف العنصر'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Dependency Summary Badges */}
        <div className="flex flex-wrap items-center gap-2 bg-bg p-3 rounded-lg border border-border">
          <Badge variant={currentDeps.users.length > 0 ? 'warning' : 'success'} size="sm">
            المستخدمون المرتبطون: {currentDeps.users.length}
          </Badge>
          {catalog === 'departments' && (
            <Badge variant={currentDeps.jobTitles.length > 0 ? 'warning' : 'success'} size="sm">
              المسميات المرتبطة: {currentDeps.jobTitles.length}
            </Badge>
          )}
          <Badge variant={currentDeps.courses.length > 0 ? 'warning' : 'success'} size="sm">
            الدورات المستهدفة: {currentDeps.courses.length}
          </Badge>
        </div>

        {submitError && (
          <Alert variant="danger" title="تعذر إتمام الإجراء">
            {submitError}
          </Alert>
        )}

        {currentDeps.hasProtectedUsers && (
          <Alert variant="warning" title="توجد حسابات محمية بصلاحية أعلى">
            بعض المستخدمين المرتبطين بهذا العنصر ذوو صلاحية أعلى من صلاحيتك الحالية ولا يمكن تعديلهم من هنا؛ يلزم تدخل المسؤول الأعلى لنقلهم قبل الحذف النهائي.
          </Alert>
        )}

        {currentDeps.canDeleteDirectly && (
          <Alert variant="success" title="العنصر جاهز للحذف">
            تم تفريغ جميع الارتباطات المعيقة. اضغط على «تأكيد الحذف النهائي الآن» لإتمام الحذف.
          </Alert>
        )}

        {/* Section 1: Linked Users */}
        {currentDeps.users.length > 0 && (
          <div className="border border-border rounded-xl p-4 space-y-3 bg-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-text-heading">
                1. المستخدمون المرتبطون ({currentDeps.users.length})
              </h3>
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="بحث بالاسم أو الرقم الوظيفي..."
                data-testid="resolve-user-search-input"
                className="bg-bg text-text text-xs rounded-lg border border-border focus:border-primary py-1.5 px-3 outline-none sm:w-60"
              />
            </div>

            {!currentDeps.supportsUnassign && (
              <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
                خط المترو حقل إلزامي في ملف الموظف؛ يجب نقل المستخدمين إلى خط مترو بديل قبل الحذف.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text">الإجراء للمستخدمين المحددين</label>
                <StyledSelect
                  dataTestId="resolve-user-action-select"
                  value={userAction}
                  disabled={isSubmitting}
                  onChange={(val) => setUserAction(val as 'transfer' | 'unassign' | 'none')}
                  options={[
                    ...(otherAlternatives.length > 0
                      ? [{ value: 'transfer', label: 'نقل المحددين إلى بديل' }]
                      : []),
                    ...(currentDeps.supportsUnassign
                      ? [{ value: 'unassign', label: unassignLabel }]
                      : []),
                    { value: 'none', label: 'تخطي تعديل المستخدمين حالياً' },
                  ]}
                />
              </div>

              {userAction === 'transfer' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-text">الوجهة البديلة</label>
                  <StyledSelect
                    dataTestId="resolve-user-target-select"
                    value={targetId}
                    disabled={isSubmitting}
                    placeholder="اختر الوجهة البديلة"
                    emptyMessage="لا توجد بدائل متاحة"
                    onChange={(val) => {
                      setTargetId(val);
                      setTargetJobTitleId('');
                    }}
                    options={otherAlternatives.map((alt) => ({
                      value: String(alt.id),
                      label: alt.nameAr,
                    }))}
                  />
                </div>
              )}
            </div>

            {catalog === 'departments' && userAction === 'transfer' && targetId && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text">
                  المسمى الوظيفي في الإدارة الجديدة (اختياري)
                </label>
                <StyledSelect
                  dataTestId="resolve-user-target-job-select"
                  value={targetJobTitleId}
                  disabled={isSubmitting}
                  onChange={(val) => setTargetJobTitleId(val)}
                  options={[
                    { value: '', label: 'الإبقاء على المسمى العام المتوافق (أو بدون مسمى)' },
                    ...targetDeptScopedJobTitles.map((jt) => ({
                      value: String(jt.id),
                      label: jt.nameAr,
                    })),
                  ]}
                />
              </div>
            )}

            {userAction !== 'none' && selectedUserIds.length > 0 && (
              <p className="text-[11px] text-text-muted">
                تنبيه: نقل أو فك ارتباط الموظفين يحدّث تلقائياً تسجيلهم في الدورات المستهدفة المرتبطة بالبيانات السابقة.
              </p>
            )}

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-bg px-3 py-2 border-b border-border flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 font-semibold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allModifiableFilteredSelected}
                    disabled={modifiableFilteredUsers.length === 0 || isSubmitting}
                    onChange={toggleAllVisibleUsers}
                    data-testid="resolve-select-all-users"
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span>تحديد الكل ({selectedUserIds.length} محدد)</span>
                </label>
                <span className="text-text-muted">يتم تعديل الحسابات ضمن صلاحيتك فقط</span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-border">
                {filteredUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-text-muted">
                    لا توجد نتائج مطابقة للبحث.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const checked = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors ${
                          u.canModify ? 'cursor-pointer hover:bg-bg/60' : 'opacity-65 bg-bg/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!u.canModify || isSubmitting}
                            onChange={() => toggleUser(u.id)}
                            data-testid={`resolve-user-checkbox-${u.id}`}
                            className="rounded border-border text-primary focus:ring-primary shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-text-heading truncate">{u.name}</p>
                            <p className="text-[11px] text-text-muted truncate">
                              {ROLE_AR[u.role] || u.role}
                              {u.employeeNumber ? ` • ${u.employeeNumber}` : ''}
                              {u.jobTitle ? ` • ${u.jobTitle}` : ''}
                            </p>
                          </div>
                        </div>
                        {!u.canModify && (
                          <Badge variant="warning" size="sm">
                            محمي
                          </Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Linked Job Titles (Departments only) */}
        {catalog === 'departments' && currentDeps.jobTitles.length > 0 && (
          <div className="border border-border rounded-xl p-4 space-y-3 bg-surface">
            <h3 className="text-sm font-bold text-text-heading">
              2. المسميات الوظيفية المرتبطة بالقطاع ({currentDeps.jobTitles.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text">الإجراء للمسميات المحددة</label>
                <StyledSelect
                  dataTestId="resolve-jobtitle-action-select"
                  value={jobTitleAction}
                  disabled={isSubmitting}
                  onChange={(val) => setJobTitleAction(val as 'make_global' | 'transfer' | 'none')}
                  options={[
                    { value: 'make_global', label: 'تحويل إلى «عام (لكل الإدارات)» وفك الربط' },
                    ...(otherDepartments.length > 0
                      ? [{ value: 'transfer', label: 'نقل المسميات إلى قطاع بديل' }]
                      : []),
                    { value: 'none', label: 'تركها بدون تغيير الآن' },
                  ]}
                />
              </div>

              {jobTitleAction === 'transfer' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-text">القطاع البديل للمسميات</label>
                  <StyledSelect
                    dataTestId="resolve-jobtitle-target-dept-select"
                    value={targetJobDeptId}
                    disabled={isSubmitting}
                    onChange={(val) => setTargetJobDeptId(val)}
                    options={otherDepartments.map((d) => ({
                      value: String(d.id),
                      label: d.nameAr,
                    }))}
                  />
                </div>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {currentDeps.jobTitles.map((jt) => (
                <label
                  key={jt.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-bg/60"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedJobTitleIds.includes(jt.id)}
                      disabled={isSubmitting}
                      onChange={() => toggleJobTitle(jt.id)}
                      className="rounded border-border text-primary"
                    />
                    <span className="font-semibold text-text-heading">{jt.nameAr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {jt.linkedUsersCount > 0 && (
                      <Badge variant="warning" size="sm">
                        {jt.linkedUsersCount} مستخدم
                      </Badge>
                    )}
                    <Badge variant="neutral" size="sm">
                      {jt.isPrimaryScoped ? 'مسمى تابع للقطاع' : 'رابط مسمى'}
                    </Badge>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Targeted Courses */}
        {currentDeps.courses.length > 0 && (
          <div className="border border-border rounded-xl p-4 space-y-3 bg-surface">
            <h3 className="text-sm font-bold text-text-heading">
              الدورات المستهدفة المرتبطة ({currentDeps.courses.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-text">الإجراء للدورات المحددة</label>
                <StyledSelect
                  dataTestId="resolve-course-action-select"
                  value={courseAction}
                  disabled={isSubmitting}
                  onChange={(val) => setCourseAction(val as 'remove' | 'replace' | 'none')}
                  options={[
                    { value: 'remove', label: 'إزالة العنصر من جمهور الدورات المحددة' },
                    ...(otherAlternatives.length > 0
                      ? [{ value: 'replace', label: 'استبدال بعنصر بديل في جمهور الدورات' }]
                      : []),
                    { value: 'none', label: 'ترك الدورات بدون تغيير الآن' },
                  ]}
                />
              </div>

              {courseAction === 'replace' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-text">العنصر البديل في الدورات</label>
                  <StyledSelect
                    dataTestId="resolve-course-target-select"
                    value={targetCourseReplId}
                    disabled={isSubmitting}
                    onChange={(val) => setTargetCourseReplId(val)}
                    options={otherAlternatives.map((alt) => ({
                      value: String(alt.id),
                      label: alt.nameAr,
                    }))}
                  />
                </div>
              )}
            </div>

            <div className="max-h-36 overflow-y-auto border border-border rounded-lg divide-y divide-border">
              {currentDeps.courses.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-bg/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.includes(c.id)}
                      disabled={isSubmitting}
                      onChange={() => toggleCourse(c.id)}
                      className="rounded border-border text-primary shrink-0"
                    />
                    <span className="font-semibold text-text-heading truncate">{c.title}</span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {c.lifecycleStatus}
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
