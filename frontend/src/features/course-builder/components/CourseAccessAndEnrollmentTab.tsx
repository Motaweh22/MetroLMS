import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  Course,
  CourseAccessMode,
  CourseEnrollmentMember,
  CourseLinkedGroupSummary,
  CourseQrMode,
  CourseQrSettings,
} from '@/core/courses/types';
import { coursesApi } from '@/features/courses/services/coursesApi';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { QRCodeModal } from '@/shared/ui/QRCodeModal';
import { useToast } from '@/shared/ui/Toast';

export interface CourseAccessAndEnrollmentTabProps {
  course: Course;
  onChange: (updatedCourse: Course) => void;
}

const ACCESS_MODE_OPTIONS: Array<{
  value: CourseAccessMode;
  title: string;
  description: string;
  badge: string;
}> = [
  {
    value: 'all_trainees',
    title: 'متاح لكل الملتحقين بالمترو',
    description: 'يظهر المقرر في الكتالوج لجميع المتدربين المسجلين في المنصة أياً كان القطاع أو المسمى الوظيفي.',
    badge: 'عام للمترو',
  },
  {
    value: 'targeted',
    title: 'متاح حسب الجمهور المستهدف',
    description: 'يظهر في الكتالوج فقط للمتدربين المطابقين للقطاعات أو المسميات الوظيفية أو خطوط المترو المحددة.',
    badge: 'مستهدف',
  },
  {
    value: 'hidden',
    title: 'مخفي — عبر المجموعات والأعضاء المسجلين فقط',
    description: 'لا يظهر المقرر في الكتالوج العام؛ ولا يصل إليه إلا أعضاء المجموعات المرتبطة أو المضافون يدوياً أو عبر QR.',
    badge: 'مخفي',
  },
];

const SOURCE_LABELS: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' | 'neutral' }> = {
  direct: { label: 'إضافة مباشرة', variant: 'primary' },
  group: { label: 'مجموعة تدريبية', variant: 'success' },
  qr_code: { label: 'رمز QR', variant: 'warning' },
  'self:continued': { label: 'استمرار ذاتي', variant: 'neutral' },
};

function toLocalDateTimeInput(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const CourseAccessAndEnrollmentTab: React.FC<CourseAccessAndEnrollmentTabProps> = ({
  course,
  onChange,
}) => {
  const toast = useToast();
  const accessMode: CourseAccessMode = course.accessMode || 'targeted';

  const [enrollments, setEnrollments] = useState<CourseEnrollmentMember[]>([]);
  const [linkedGroups, setLinkedGroups] = useState<CourseLinkedGroupSummary[]>([]);
  const [qrSettings, setQrSettings] = useState<CourseQrSettings>(
    course.qrSettings || {
      token: null,
      isEnabled: true,
      qrMode: 'view_only',
      expiresAt: null,
    }
  );
  const [expiresAtInput, setExpiresAtInput] = useState<string>(
    toLocalDateTimeInput(course.qrSettings?.expiresAt)
  );
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isRotatingQr, setIsRotatingQr] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Direct Member Add Modal State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [candidateUsers, setCandidateUsers] = useState<
    Array<{ id: number; name: string; email?: string; department?: string }>
  >([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  const loadAccessData = useCallback(async () => {
    setIsLoadingMeta(true);
    try {
      const [enrList, grpList, qr] = await Promise.all([
        coursesApi.getCourseEnrollments(course.id).catch(() => []),
        coursesApi.getCourseLinkedGroups(course.id).catch(() => []),
        coursesApi.getCourseQrSettings(course.id).catch(() => null),
      ]);
      setEnrollments(enrList);
      setLinkedGroups(grpList);
      if (qr) {
        setQrSettings(qr);
        setExpiresAtInput(toLocalDateTimeInput(qr.expiresAt));
      }
    } finally {
      setIsLoadingMeta(false);
    }
  }, [course.id]);

  useEffect(() => {
    loadAccessData();
  }, [loadAccessData]);

  const handleOpenAddMemberModal = async () => {
    setIsAddMemberOpen(true);
    setSelectedUserIds([]);
    setMemberSearch('');
    try {
      const users = await userManagementApi.getManagedUsers();
      const enrolledIds = new Set(enrollments.map((e) => e.userId));
      const activeTrainees = users
        .filter((u) => String(u.status || '').toLowerCase() === 'active')
        .filter((u) => !enrolledIds.has(Number(u.id)))
        .map((u) => ({
          id: Number(u.id),
          name: u.name,
          email: u.email,
          department: u.department,
        }));
      setCandidateUsers(activeTrainees);
    } catch {
      setCandidateUsers([]);
    }
  };

  const filteredCandidates = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return candidateUsers;
    return candidateUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
    );
  }, [candidateUsers, memberSearch]);

  const handleConfirmAddMembers = async () => {
    if (selectedUserIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      const res = await coursesApi.bulkAddCourseEnrollments(course.id, selectedUserIds);
      setEnrollments(res.enrollments);
      setIsAddMemberOpen(false);
      toast.success(`تمت إضافة ${res.addedCount} عضو(أعضاء) إلى المقرر بنجاح.`);
    } catch {
      toast.error('تعذر إضافة الأعضاء المحددين، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRevokeDirect = async (userId: number) => {
    try {
      await coursesApi.revokeDirectCourseEnrollment(course.id, userId);
      const updated = await coursesApi.getCourseEnrollments(course.id);
      setEnrollments(updated);
      toast.success('تمت إزالة التسجيل المباشر للعضو.');
    } catch {
      toast.error('تعذر إزالة العضو.');
    }
  };

  const handleSaveQrSettings = async (override?: Partial<CourseQrSettings>) => {
    setIsSavingQr(true);
    try {
      const nextEnabled = override?.isEnabled !== undefined ? override.isEnabled : qrSettings.isEnabled;
      const nextMode: CourseQrMode = override?.qrMode || qrSettings.qrMode;
      const nextExpiresAt =
        override?.expiresAt !== undefined
          ? override.expiresAt
          : expiresAtInput
          ? new Date(expiresAtInput).toISOString()
          : null;
      const updated = await coursesApi.updateCourseQrSettings(course.id, {
        isEnabled: nextEnabled,
        qrMode: nextMode,
        expiresAt: nextExpiresAt,
      });
      setQrSettings(updated);
      setExpiresAtInput(toLocalDateTimeInput(updated.expiresAt));
      onChange({ ...course, qrSettings: updated });
      toast.success('تم حفظ إعدادات رمز QR بنجاح.');
    } catch {
      toast.error('تعذر حفظ إعدادات رمز QR.');
    } finally {
      setIsSavingQr(false);
    }
  };

  const handleRotateQr = async () => {
    setIsRotatingQr(true);
    try {
      const updated = await coursesApi.rotateCourseQrToken(course.id);
      setQrSettings(updated);
      onChange({ ...course, qrSettings: updated });
      toast.success('تم توليد رمز QR جديد وإبطال الرمز السابق.');
    } catch {
      toast.error('تعذر إعادة توليد رمز QR.');
    } finally {
      setIsRotatingQr(false);
    }
  };

  const qrJoinUrl = qrSettings.token
    ? `${window.location.origin}/courses/join/${encodeURIComponent(qrSettings.token)}`
    : `${window.location.origin}/courses/${encodeURIComponent(course.id)}`;

  const handleCopyQrUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrJoinUrl);
      toast.success('تم نسخ رابط رمز QR.');
    } catch {
      toast.warning('تعذر نسخ الرابط تلقائياً.');
    }
  };

  return (
    <div className="space-y-6" data-testid="access-enrollment-tab">
      {/* 1. Visibility & Access Mode */}
      <section className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="shield" size="sm" />
            </span>
            <div>
              <h2 className="text-base font-bold text-text-heading">نمط الوصول والظهور في الكتالوج</h2>
              <p className="text-xs text-text-muted">
                حدد من يمكنه رؤية هذا المقرر في الكتالوج والوصول إليه (لا تنسَ الضغط على «حفظ المسودة» لتثبيت التغيير)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ACCESS_MODE_OPTIONS.map((opt) => {
            const selected = accessMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...course, accessMode: opt.value })}
                data-testid={`access-mode-option-${opt.value}`}
                className={`text-right p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-2 ${
                  selected
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border bg-white hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-sm font-bold text-text-heading">{opt.title}</span>
                  <Badge variant={selected ? 'primary' : 'neutral'} size="sm">
                    {opt.badge}
                  </Badge>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Linked Training Groups & Direct Enrolled Members */}
      <section className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="users" size="sm" />
            </span>
            <div>
              <h2 className="text-base font-bold text-text-heading">الأعضاء المسجلون والمجموعات التدريبية</h2>
              <p className="text-xs text-text-muted">
                إدارة الأعضاء المضافين مباشرةً للمقرر وعرض المجموعات التدريبية التي تمنح صلاحية الوصول
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenAddMemberModal}
            data-testid="open-add-course-members-btn"
          >
            + إضافة أعضاء للكورس
          </Button>
        </div>

        {/* Linked Groups */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-text-heading">
            المجموعات التدريبية المرتبطة بالمقرر ({linkedGroups.length})
          </h3>
          {isLoadingMeta ? (
            <p className="text-xs text-text-muted">جاري تحميل المجموعات...</p>
          ) : linkedGroups.length === 0 ? (
            <div className="p-3 rounded-xl border border-dashed border-border text-xs text-text-muted">
              لا توجد مجموعات تدريبية مرتبطة بهذا المقرر حالياً. يمكنك ربطه من شاشة إدارة المجموعات التدريبية.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linkedGroups.map((g) => (
                <Link
                  key={g.id}
                  to={`/admin/groups/${encodeURIComponent(g.id)}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white hover:border-primary/50 text-xs font-semibold text-text-heading transition-colors"
                >
                  <span>{g.name}</span>
                  <Badge variant="neutral" size="sm">
                    {g.memberCount} عضو
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Enrolled Members */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-text-heading">
            الأعضاء المسجلون حالياً ({enrollments.length})
          </h3>
          {enrollments.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-xs text-text-muted text-center">
              لا يوجد متدربون مسجلون مباشرة في هذا المقرر حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto border border-border rounded-xl bg-white">
              <table className="w-full text-right text-xs">
                <thead className="bg-surface border-b border-border text-text-muted">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">المتدرب</th>
                    <th className="py-2.5 px-3 font-bold">البريد الإلكتروني</th>
                    <th className="py-2.5 px-3 font-bold">مصدر التسجيل</th>
                    <th className="py-2.5 px-3 font-bold text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {enrollments.map((enr) => {
                    const hasRemovableGrant = enr.sourceGrants.some(
                      (g) => g.sourceType === 'direct' || g.sourceType === 'qr_code' || g.sourceType === 'self:continued'
                    );
                    return (
                      <tr key={enr.id} className="hover:bg-surface/40">
                        <td className="py-2.5 px-3 font-semibold text-text-heading">
                          <Link
                            to={`/users/${encodeURIComponent(String(enr.userId))}`}
                            className="hover:text-primary hover:underline"
                          >
                            {enr.userName || `مستخدم #${enr.userId}`}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3 text-text-muted font-mono">
                          {enr.userEmail || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {enr.sourceGrants.map((g) => {
                              const meta = SOURCE_LABELS[g.sourceType] || {
                                label: g.sourceType,
                                variant: 'neutral' as const,
                              };
                              return (
                                <Badge key={g.id} variant={meta.variant} size="sm">
                                  {meta.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-left">
                          {hasRemovableGrant ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeDirect(enr.userId)}
                              className="text-danger hover:underline font-semibold"
                            >
                              إزالة المباشر
                            </button>
                          ) : (
                            <span className="text-text-muted">عبر المجموعة</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 3. Course QR Code Settings */}
      <section className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="link" size="sm" />
            </span>
            <div>
              <h2 className="text-base font-bold text-text-heading">إعدادات رمز QR والانضمام السريع</h2>
              <p className="text-xs text-text-muted">
                تحكم في صلاحية رمز QR الخاص بالمقرر وسلوك المسح وتاريخ انتهاء الصلاحية
              </p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-text-heading">
            <input
              type="checkbox"
              checked={qrSettings.isEnabled}
              onChange={(e) => handleSaveQrSettings({ isEnabled: e.target.checked })}
              className="w-4 h-4 accent-primary rounded"
              data-testid="course-qr-enabled-toggle"
            />
            <span>{qrSettings.isEnabled ? 'رمز QR مفعّل' : 'رمز QR معطّل'}</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-heading">سلوك المسح عبر QR</label>
            <select
              value={qrSettings.qrMode}
              onChange={(e) => setQrSettings((prev) => ({ ...prev, qrMode: e.target.value as CourseQrMode }))}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-heading"
              data-testid="course-qr-mode-select"
            >
              <option value="view_only">فتح صفحة المقرر فقط (يخضع لقواعد الظهور)</option>
              <option value="auto_enroll">تسجيل المتدرب تلقائياً في المقرر عند المسح</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-text-heading">
              تاريخ انتهاء صلاحية الرمز (اختياري)
            </label>
            <input
              type="datetime-local"
              value={expiresAtInput}
              onChange={(e) => setExpiresAtInput(e.target.value)}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-text-heading"
              data-testid="course-qr-expires-input"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-text-muted truncate" dir="ltr">
            {qrJoinUrl}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={handleCopyQrUrl}>
              نسخ الرابط
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotateQr}
              disabled={isRotatingQr}
              data-testid="course-qr-rotate-btn"
            >
              {isRotatingQr ? 'جاري التحديث...' : 'إعادة توليد الرمز'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQrModalOpen(true)}
              data-testid="course-qr-preview-btn"
            >
              عرض وتنزيل QR
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleSaveQrSettings()}
              disabled={isSavingQr}
              data-testid="course-qr-save-btn"
            >
              {isSavingQr ? 'جاري الحفظ...' : 'حفظ إعدادات QR'}
            </Button>
          </div>
        </div>
      </section>

      {/* Add Members Modal */}
      {isAddMemberOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          data-testid="add-course-members-modal"
        >
          <div className="bg-white rounded-2xl border border-border shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-sm font-bold text-text-heading">إضافة أعضاء مباشرة إلى المقرر</h3>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="text-text-muted hover:text-text text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="ابحث بالاسم أو البريد أو القطاع..."
              className="w-full rounded-xl border border-border px-3 py-2 text-xs"
            />

            <div className="max-h-64 overflow-y-auto divide-y divide-border/60 border border-border rounded-xl">
              {filteredCandidates.length === 0 ? (
                <p className="p-4 text-xs text-text-muted text-center">لا يوجد متدربون متاحون للإضافة.</p>
              ) : (
                filteredCandidates.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center justify-between gap-3 p-3 hover:bg-surface cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedUserIds((prev) =>
                              prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                            )
                          }
                          className="w-4 h-4 accent-primary"
                        />
                        <div>
                          <div className="font-bold text-text-heading">{u.name}</div>
                          <div className="text-[11px] text-text-muted">{u.email || '—'}</div>
                        </div>
                      </div>
                      {u.department && (
                        <Badge variant="neutral" size="sm">
                          {u.department}
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-text-muted">المحددون: {selectedUserIds.length}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddMemberOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={selectedUserIds.length === 0 || isAddingMembers}
                  onClick={handleConfirmAddMembers}
                  data-testid="confirm-add-course-members-btn"
                >
                  {isAddingMembers ? 'جاري الإضافة...' : 'إضافة المحددين'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview Modal */}
      {isQrModalOpen && (
        <QRCodeModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          title={course.title}
          url={qrJoinUrl}
          subtitle={`المحاضر: ${course.lecturerName}`}
          badgeLabel={`المقرر ${course.id}`}
          downloadFilename={`course-${course.id}-qr.png`}
          isExternalResource={false}
        />
      )}
    </div>
  );
};

export default CourseAccessAndEnrollmentTab;
