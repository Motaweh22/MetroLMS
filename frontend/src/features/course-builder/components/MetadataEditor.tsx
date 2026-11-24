import React, { useEffect, useState } from 'react';
import { apiClient } from '@/core/api/apiClient';
import type { Course, CourseLevel } from '@/core/courses/types';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { StyledSelect } from '@/shared/ui/StyledSelect';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { ExternalResourcesEditor } from '@/features/courses/components/ExternalResourcesEditor';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { userManagementApi } from '@/features/user-management/services/userManagementApi';
import { AudienceSelectionModal } from './AudienceSelectionModal';
import { AudienceSectionCard } from './AudienceSectionCard';
import { blockInvalidNumberKeys, sanitizePhoneInput } from '@/core/utils/numericInput';
import { DEFAULT_LEADERSHIP_TITLES } from '@/core/user-management/types';

const DEFAULT_LEADERSHIP_TITLE_OPTIONS: Array<{ id: number; label: string }> =
  DEFAULT_LEADERSHIP_TITLES.map((label, idx) => ({ id: idx + 1, label }));

export interface MetadataEditorProps {
  course: Course;
  onChange: (updatedCourse: Course) => void;
  availableCourses?: Course[];
  availableLecturers?: Array<{ id: string; name: string; email?: string; phone?: string; department?: string }>;
  isAdmin?: boolean;
  sectionFilter?: 'all' | 'basic' | 'requirements' | 'team';
}

const BRAND_COVER_COLORS = [
  { id: '#003366', label: 'كحلي المترو الرسمي', bgClass: 'bg-[#003366]' },
  { id: '#1E3A8A', label: 'أزرق داكن أمني', bgClass: 'bg-[#1E3A8A]' },
  { id: '#1E293B', label: 'رمادي فحمي هندسي', bgClass: 'bg-[#1E293B]' },
  { id: '#065F46', label: 'أخضر مسار التشغيل', bgClass: 'bg-[#065F46]' },
  { id: '#0F766E', label: 'تركواز الإشارات والاتصالات', bgClass: 'bg-[#0F766E]' },
  { id: '#831843', label: 'عنابي أسطول الخط الثالث', bgClass: 'bg-[#831843]' },
  { id: '#78350F', label: 'بني نحاسي للصيانة', bgClass: 'bg-[#78350F]' },
  { id: '#581C87', label: 'بنفسجي الإدارة المركزية', bgClass: 'bg-[#581C87]' },
];

/**
 * Reusable Section Header for Section Cards
 */
interface SectionHeaderProps {
  icon: SemanticIconName;
  iconNode?: React.ReactNode;
  iconWrapperClassName?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

const WhatsAppBrandIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zM12.04 3.67c4.46 0 8.08 3.62 8.08 8.08 0 4.46-3.62 8.08-8.08 8.08-1.42 0-2.81-.38-4.02-1.11l-.29-.17-3.02.79.81-2.94-.19-.31A7.973 7.973 0 0 1 3.96 11.75c0-4.46 3.62-8.08 8.08-8.08zm4.62 9.77c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.17.25-.66.81-.81.98-.15.17-.31.19-.56.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.15-.25-.02-.39.11-.52.11-.11.25-.31.38-.47.13-.17.17-.29.25-.48.08-.19.04-.36-.02-.5-.06-.13-.57-1.38-.78-1.89-.2-.5-.41-.43-.57-.44h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.02 2.61.13.17 1.77 2.7 4.29 3.79.6.26 1.07.42 1.44.54.61.2 1.16.17 1.6-.1.49-.3 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29z" />
  </svg>
);

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  iconNode,
  iconWrapperClassName = 'bg-primary/10 text-primary',
  title,
  subtitle,
  badge,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/70 gap-3">
    <div className="flex items-center gap-3">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconWrapperClassName}`}>
        {iconNode || <Icon name={icon} size="sm" />}
      </span>
      <div>
        <h3 className="text-sm font-bold text-text-heading">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {badge && <div className="self-start sm:self-auto">{badge}</div>}
  </div>
);

export const MetadataEditor: React.FC<MetadataEditorProps> = ({
  course,
  onChange,
  availableCourses = [],
  availableLecturers,
  isAdmin,
  sectionFilter = 'all',
}) => {
  const showBasic = sectionFilter === 'all' || sectionFilter === 'basic';
  const showRequirements = sectionFilter === 'all' || sectionFilter === 'requirements';
  const showTeam = sectionFilter === 'all' || sectionFilter === 'team';

  const { user } = useAuth();
  const effectiveIsAdmin =
    isAdmin !== undefined
      ? isAdmin
      : user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer';

  const [fetchedLecturers, setFetchedLecturers] = useState<
    Array<{ id: string; name: string; email?: string; phone?: string; department?: string }>
  >([]);

  useEffect(() => {
    if (availableLecturers && availableLecturers.length > 0) return;
    let cancelled = false;
    userManagementApi
      .getManagedUsers()
      .then((users) => {
        if (cancelled || !Array.isArray(users)) return;
        const eligible = users
          .filter((u) => String(u.status || '').toLowerCase() === 'active')
          .filter((u) => u.role === 'lecturer' || u.role === 'admin' || u.role === 'super_admin' || u.role === 'assistant_admin')
          .map((u) => ({
            id: String(u.id),
            name: u.name,
            email: u.email,
            phone: (u as { phoneE164?: string }).phoneE164 || u.phone,
            department: u.department,
          }));
        setFetchedLecturers(eligible);
      })
      .catch(() => {
        // Non-blocking fallback
      });
    return () => {
      cancelled = true;
    };
  }, [availableLecturers]);

  const lecturersList =
    availableLecturers && availableLecturers.length > 0 ? availableLecturers : fetchedLecturers;

  // Selected Co-Lecturer to add from dropdown
  const [selectedCoLecturerToAdd, setSelectedCoLecturerToAdd] = useState('');

  const handleAddCoLecturer = () => {
    if (!selectedCoLecturerToAdd) return;
    const current = course.coLecturers || [];
    if (!current.includes(selectedCoLecturerToAdd)) {
      handleFieldChange('coLecturers', [...current, selectedCoLecturerToAdd]);
    }
    setSelectedCoLecturerToAdd('');
  };

  const handleRemoveCoLecturer = (lecturerIdToRemove: string) => {
    const current = course.coLecturers || [];
    handleFieldChange(
      'coLecturers',
      current.filter((id) => id !== lecturerIdToRemove)
    );
  };

  const handlePrimaryLecturerChange = (newLecturerId: string) => {
    const found = lecturersList.find((l) => l.id.toLowerCase() === newLecturerId.toLowerCase());
    if (!found) return;
    onChange({
      ...course,
      lecturerId: found.id,
      lecturerName: found.name,
      coLecturers: (course.coLecturers || []).filter(
        (id) => id.toLowerCase() !== found.id.toLowerCase()
      ),
    });
  };

  // Knowledge Prerequisites State (free-text requirements)
  const [newKnowledgePrereq, setNewKnowledgePrereq] = useState('');
  const [editingKnowledgeIdx, setEditingKnowledgeIdx] = useState<number | null>(null);
  const [editingKnowledgeText, setEditingKnowledgeText] = useState('');

  // Selected Prerequisite Course from dropdown
  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState('');

  const handleFieldChange = <K extends keyof Course>(field: K, value: Course[K]) => {
    onChange({
      ...course,
      [field]: value,
    });
  };

  // --- Course WhatsApp Overrides ---
  const hasWhatsAppOverride = Boolean(
    course.whatsappContacts && course.whatsappContacts.length > 0
  );

  const handleEnableOverride = () => {
    handleFieldChange('whatsappContacts', [
      {
        name: course.lecturerName || 'محاضر المقرر',
        number: '',
        role: 'محاضر المقرر',
      },
    ]);
  };

  const handleClearOverride = () => {
    handleFieldChange('whatsappContacts', []);
  };

  const handleAddContact = () => {
    const current = course.whatsappContacts || [];
    handleFieldChange('whatsappContacts', [
      ...current,
      { name: '', number: '', role: 'دعم المقرر' },
    ]);
  };

  const handleUpdateContact = (
    index: number,
    field: 'name' | 'number' | 'role',
    value: string
  ) => {
    const current = [...(course.whatsappContacts || [])];
    if (current[index]) {
      current[index] = { ...current[index], [field]: value };
      handleFieldChange('whatsappContacts', current);
    }
  };

  const handleRemoveContact = (index: number) => {
    const current = [...(course.whatsappContacts || [])];
    current.splice(index, 1);
    handleFieldChange('whatsappContacts', current);
  };

  // --- Target Job Titles ---
  const [orgDepartments, setOrgDepartments] = useState<Array<{ id: number; nameAr: string }>>([]);
  const [orgJobTitles, setOrgJobTitles] = useState<
    Array<{ id: number; nameAr: string; departmentId?: number | null }>
  >([]);
  const [orgMetroLines, setOrgMetroLines] = useState<Array<{ id: number; nameAr: string }>>([]);
  const [orgLeadershipTitles, setOrgLeadershipTitles] = useState<Array<{ id: number; label: string }>>(
    DEFAULT_LEADERSHIP_TITLE_OPTIONS
  );
  const [expandedAudience, setExpandedAudience] = useState<{
    departments: boolean;
    jobTitles: boolean;
    metroLines: boolean;
    leadership: boolean;
  }>({
    departments: false,
    jobTitles: false,
    metroLines: false,
    leadership: false,
  });
  const [activeAudienceModal, setActiveAudienceModal] = useState<
    'departments' | 'jobTitles' | 'metroLines' | 'leadership' | null
  >(null);

  const toggleAudienceExpand = (key: keyof typeof expandedAudience) => {
    setExpandedAudience((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiClient<{ departments?: Array<{ id: number; nameAr: string }> }>(
        '/api/admin/organization/departments'
      ),
      apiClient<{ jobTitles?: Array<{ id: number; nameAr: string; departmentId?: number | null }> }>(
        '/api/admin/organization/job-titles'
      ),
      apiClient<{ metroLines?: Array<{ id: number; nameAr: string }> }>(
        '/api/admin/organization/metro-lines'
      ),
      apiClient<{ leadershipTitles?: Array<{ id: number; nameAr: string }> }>(
        '/api/admin/organization/leadership-titles'
      ),
    ]).then(([deptRes, jobRes, lineRes, leadershipRes]) => {
      if (!active) return;
      if (deptRes.status === 'fulfilled') setOrgDepartments(deptRes.value.departments || []);
      if (jobRes.status === 'fulfilled') setOrgJobTitles(jobRes.value.jobTitles || []);
      if (lineRes.status === 'fulfilled') setOrgMetroLines(lineRes.value.metroLines || []);
      if (leadershipRes.status === 'fulfilled') {
        const items = (leadershipRes.value.leadershipTitles || [])
          .filter((lt) => Boolean(lt.nameAr))
          .map((lt) => ({ id: Number(lt.id), label: lt.nameAr }));
        if (items.length > 0) setOrgLeadershipTitles(items);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveAudienceIds = (
    field: 'targetDepartmentIds' | 'targetJobTitleIds' | 'targetMetroLineIds',
    nextIds: number[]
  ) => {
    if (field === 'targetJobTitleIds') {
      const selectedNames = orgJobTitles.filter((j) => nextIds.includes(j.id)).map((j) => j.nameAr);
      onChange({ ...course, targetJobTitleIds: nextIds, targetJobTitles: selectedNames });
      return;
    }
    handleFieldChange(field, nextIds);
  };

  const deptNameById = new Map(orgDepartments.map((d) => [d.id, d.nameAr]));
  const jobNameById = new Map(orgJobTitles.map((j) => [j.id, j.nameAr]));
  const lineNameById = new Map(orgMetroLines.map((l) => [l.id, l.nameAr]));

  // --- Knowledge Prerequisites (Free-Text Chips) ---
  const handleAddKnowledgePrereq = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKnowledgePrereq.trim();
    if (!clean) return;
    const current = course.knowledgePrerequisites || [];
    if (!current.includes(clean)) {
      handleFieldChange('knowledgePrerequisites', [...current, clean]);
    }
    setNewKnowledgePrereq('');
  };

  const handleRemoveKnowledgePrereq = (idx: number) => {
    const current = course.knowledgePrerequisites || [];
    const updated = current.filter((_, i) => i !== idx);
    handleFieldChange('knowledgePrerequisites', updated);
    if (editingKnowledgeIdx === idx) {
      setEditingKnowledgeIdx(null);
    }
  };

  const handleStartEditKnowledge = (idx: number, text: string) => {
    setEditingKnowledgeIdx(idx);
    setEditingKnowledgeText(text);
  };

  const handleSaveEditKnowledge = (idx: number) => {
    const clean = editingKnowledgeText.trim();
    if (!clean) return;
    const current = [...(course.knowledgePrerequisites || [])];
    current[idx] = clean;
    handleFieldChange('knowledgePrerequisites', current);
    setEditingKnowledgeIdx(null);
  };

  // --- Course Prerequisites (Multiple Course Selection) ---
  const currentPrereqCourseIds = course.prerequisiteCourseIds || (
    course.prerequisiteCourseId ? [course.prerequisiteCourseId] : []
  );

  const handleAddPrereqCourse = (courseIdToAdd: string) => {
    if (!courseIdToAdd) return;
    if (!currentPrereqCourseIds.includes(courseIdToAdd)) {
      const updated = [...currentPrereqCourseIds, courseIdToAdd];
      onChange({
        ...course,
        prerequisiteCourseIds: updated,
        prerequisiteCourseId: updated[0] || null, // Keep legacy field synchronized
      });
    }
    setSelectedCourseToAdd('');
  };

  const handleRemovePrereqCourse = (courseIdToRemove: string) => {
    const updated = currentPrereqCourseIds.filter((id) => id !== courseIdToRemove);
    onChange({
      ...course,
      prerequisiteCourseIds: updated,
      prerequisiteCourseId: updated.length > 0 ? updated[0] : null,
    });
  };

  // --- Cover Image & Background Color Controls ---
  const coverType = course.coverType || (course.thumbnail ? 'image' : course.coverColor ? 'color' : 'default');

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const formData = new FormData();
      formData.append('file', file);
      if (course?.id) {
        formData.append('courseId', String(course.id));
        formData.append('mediaRole', 'cover');
      }
      const resp = await fetch('/api/media/assets/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
        body: formData,
      });
      const json = await resp.json();
      if (resp.ok && json?.status === 'OK' && json?.data?.asset?.id) {
        onChange({
          ...course,
          thumbnail: `/api/media/assets/${json.data.asset.id}/stream`,
          coverType: 'image',
        });
        return;
      }
    } catch {
      // Fallback to object URL preview if offline
    }
    const objectUrl = URL.createObjectURL(file);
    onChange({
      ...course,
      thumbnail: objectUrl,
      coverType: 'image',
    });
  };

  const handleRemoveCoverImage = () => {
    onChange({
      ...course,
      thumbnail: undefined,
      coverType: course.coverColor ? 'color' : 'default',
    });
  };

  const handleSelectCoverColor = (colorHex: string) => {
    onChange({
      ...course,
      coverColor: colorHex,
      coverType: 'color',
    });
  };

  const handleSelectCoverMode = (mode: 'image' | 'color' | 'default') => {
    onChange({
      ...course,
      coverType: mode,
      ...(mode === 'color' && !course.coverColor ? { coverColor: BRAND_COVER_COLORS[0].id } : {}),
    });
  };

  return (
    <div className="space-y-6" data-testid="metadata-editor">
      {/* ======================================================== */}
      {/* Read-Only System Identity Header                         */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
        data-testid="system-identity-bar"
      >
        <div className="flex items-center gap-3">
          <span className="text-text-muted">معرف المقرر الثابت:</span>
          <Badge variant="primary" className="font-mono font-bold text-xs">
            {course.id}
          </Badge>
          <span className="text-text-muted">المحاضر المسؤول:</span>
          <strong className="text-text-heading">{course.lecturerName || 'غير معين'}</strong>
        </div>
        <div className="flex items-center gap-4 text-text-muted">
          <span>المسجلين: <strong className="text-text-heading">{course.enrollmentCount || 0}</strong></span>
          <span>التقييم: <strong className="text-warning-dark">{course.rating || 0} ★</strong></span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Instructor Assignment & Governance Section               */}
      {/* ======================================================== */}
      {showTeam && (
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="section-instructor-assignment"
        aria-labelledby="section-instructors-heading"
      >
        <SectionHeader
          icon="user"
          title="إسناد محاضري المقرر التدريبي"
          subtitle="تحديد المحاضر الرئيسي والمحاضرين المشاركين في التدريب والتواصل مع المتدربين"
          badge={
            effectiveIsAdmin ? (
              <Badge variant="primary" className="text-[11px] font-semibold" data-testid="badge-admin-assigned">
                إدارة معتمدة (Admin Only)
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-[11px] font-semibold" data-testid="badge-instructor-readonly">
                للقراءة فقط (مخصص للإدارة)
              </Badge>
            )
          }
        />

        {effectiveIsAdmin ? (
          <div className="space-y-4" data-testid="admin-instructor-controls">
            {/* Primary Lecturer Selection */}
            <div className="space-y-1.5">
              <label htmlFor="select-primary-lecturer" className="block text-xs font-bold text-text-heading">
                المحاضر الرئيسي المسؤول عن المقرر <span className="text-danger">*</span>
              </label>
              <StyledSelect
                id="select-primary-lecturer"
                dataTestId="select-primary-lecturer"
                buttonClassName="bg-surface rounded-xl py-2.5 px-3.5"
                value={course.lecturerId || ''}
                onChange={(val) => handlePrimaryLecturerChange(val)}
                placeholder="-- اختر المحاضر الرئيسي من دليل المحاضرين --"
                emptyMessage="لا يوجد محاضرون مسجلون"
                options={lecturersList.map((lec) => ({
                  value: lec.id,
                  label: `${lec.name} (${lec.id})${lec.department ? ` — ${lec.department}` : ''}`,
                }))}
              />
              <p className="text-[11px] text-text-muted">
                المحاضر المحدد هو المسؤول المعتمد عن محتوى المقرر وسير العملية التدريبية وتوريث أرقام التواصل.
              </p>
            </div>

            {/* Co-Lecturers Management */}
            <div className="space-y-2 pt-2 border-t border-border/70">
              <label className="block text-xs font-bold text-text-heading">
                المحاضرون المشاركون (Co-Lecturers)
              </label>

              {/* Existing co-lecturers list */}
              <div
                className="flex flex-wrap gap-2 items-center min-h-[38px] p-2 rounded-xl bg-neutral-light border border-border"
                data-testid="co-lecturers-list"
              >
                {!course.coLecturers || course.coLecturers.length === 0 ? (
                  <span className="text-xs text-text-muted italic px-2">
                    لا يوجد محاضرون مشاركون مسندون لهذا المقرر حالياً.
                  </span>
                ) : (
                  course.coLecturers.map((coId, idx) => {
                    const coLec = lecturersList.find((l) => l.id.toLowerCase() === coId.toLowerCase());
                    return (
                      <span
                        key={coId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface border border-border rounded-lg text-xs font-medium text-text-heading shadow-2xs"
                        data-testid={`co-lecturer-chip-${idx}`}
                      >
                        <span>{coLec ? coLec.name : coId}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCoLecturer(coId)}
                          className="text-danger hover:text-danger-dark font-bold text-xs"
                          data-testid={`btn-remove-co-lecturer-${idx}`}
                          title="إزالة المحاضر المشارك"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Add Co-Lecturer selector */}
              <div className="flex gap-2 items-center pt-1">
                <StyledSelect
                  dataTestId="select-add-co-lecturer"
                  ariaLabel="اختيار محاضر مشارك"
                  size="sm"
                  className="flex-1"
                  buttonClassName="bg-surface"
                  value={selectedCoLecturerToAdd}
                  onChange={(val) => setSelectedCoLecturerToAdd(val)}
                  placeholder="-- اختر محاضراً مشاركاً لإضافته --"
                  emptyMessage="لا يوجد محاضرون متاحون للإضافة"
                  options={[
                    { value: '', label: '-- اختر محاضراً مشاركاً لإضافته --' },
                    ...lecturersList
                      .filter((l) => l.id !== course.lecturerId && !(course.coLecturers || []).includes(l.id))
                      .map((l) => ({
                        value: l.id,
                        label: `${l.name} (${l.id})`,
                      })),
                  ]}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCoLecturer}
                  disabled={!selectedCoLecturerToAdd}
                  className="text-xs font-bold shrink-0 border-primary/40 text-primary bg-surface hover:bg-primary/10 hover:border-primary"
                  data-testid="btn-add-co-lecturer"
                >
                  <Icon name="plus" size="sm" className="ml-1" />
                  إضافة محاضر مشارك
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-neutral-light border border-border space-y-3" data-testid="lecturer-readonly-assignment">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted">المحاضر الرئيسي المسؤول:</span>
                <p className="text-sm font-bold text-text-heading mt-0.5">
                  {course.lecturerName || 'غير محدد'} ({course.lecturerId || '—'})
                </p>
              </div>
            </div>
            {course.coLecturers && course.coLecturers.length > 0 && (
              <div>
                <span className="text-xs text-text-muted">المحاضرون المشاركون:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {course.coLecturers.map((coId) => {
                    const coLec = lecturersList.find((l) => l.id.toLowerCase() === coId.toLowerCase());
                    return (
                      <Badge key={coId} variant="neutral" size="sm">
                        {coLec ? coLec.name : coId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] text-text-muted italic border-t border-border/70 pt-2" data-testid="lecturers-readonly-notice">
              تنبيه: إدارة وتعديل إسناد محاضري المقرر التدريبي مقتصرة على مدير النظام فقط.
            </p>
          </div>
        )}
      </section>
      )}

      {/* ======================================================== */}
      {/* Section A — Basic Course Information                     */}
      {/* ======================================================== */}
      {showBasic && (
      <>
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="section-basic-info"
        aria-labelledby="section-a-heading"
      >
        <SectionHeader
          icon="fileText"
          title="البيانات الأساسية للمقرر"
          subtitle="العنوان الرسمي للمقرر والوصف التعليمي الشامل لمخرجات التدريب"
          badge={<Badge variant="neutral" className="text-[11px] font-semibold">حقول إلزامية</Badge>}
        />

        <div className="space-y-4">
          {/* Course Title */}
          <div className="space-y-1.5">
            <label htmlFor="builder-title-input" className="block text-xs font-bold text-text-heading">
              عنوان المقرر التدريبي <span className="text-danger">*</span>
            </label>
            <input
              id="builder-title-input"
              type="text"
              value={course.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="أدخل عنوان البرنامج التدريبي..."
              className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              required
              data-testid="builder-title-input"
            />
            {course.title.trim().length > 0 && course.title.trim().length < 5 && (
              <p className="text-[11px] text-danger font-medium">العنوان قصير جداً — 5 أحرف على الأقل</p>
            )}
          </div>

          {/* Course Description */}
          <div className="space-y-1.5">
            <label htmlFor="builder-desc-input" className="block text-xs font-bold text-text-heading">
              وصف المقرر وأهدافه التعليمية <span className="text-danger">*</span>
            </label>
            <textarea
              id="builder-desc-input"
              rows={4}
              required
              value={course.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="قدم شرحاً موجزاً يوضح ما سيتعلمه المتدرب ومخرجات التدريب والمهارات المكتسبة..."
              className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-all leading-relaxed"
              data-testid="builder-desc-input"
            />
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* Section B — Level, Duration, and Target Audience         */}
      {/* ======================================================== */}
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="section-audience-level"
        aria-labelledby="section-b-heading"
      >
        <SectionHeader
          icon="users"
          title="المستوى التدريبي والجمهور المستهدف"
          subtitle="تحديد المستوى الفني وساعات التدريب والوظائف المؤهلة للالتحاق"
        />

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Course Level */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-heading">
                المستوى التدريبي المستهدف <span className="text-danger">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['مبتدئ', 'متوسط', 'متقدم'] as CourseLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleFieldChange('level', lvl)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      course.level === lvl
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-surface text-text-muted hover:bg-neutral-light'
                    }`}
                    data-testid={`builder-level-${lvl}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="space-y-1.5">
              <label htmlFor="builder-hours-input" className="block text-xs font-bold text-text-heading">
                المدة التقديرية (بالساعات)
              </label>
              <input
                id="builder-hours-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                value={course.estimatedHours || 4}
                onKeyDown={(e) => blockInvalidNumberKeys(e, false)}
                onChange={(e) => handleFieldChange('estimatedHours', Number(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                data-testid="builder-hours-input"
              />
            </div>
          </div>

          {/* Progressive Disclosure Audience Sections (Collapsed by Default) */}
          <div className="space-y-2.5 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-heading">الجمهور المستهدف</span>
              <span className="text-[11px] text-text-muted">
                تظهر الدورة للمتدرب إذا طابق أحد الاختيارات التالية
              </span>
            </div>

            {(course.accessMode === 'all_trainees' || course.accessMode === 'hidden') && (
              <div
                className="p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs text-text-heading"
                data-testid="audience-access-mode-notice"
              >
                {course.accessMode === 'all_trainees'
                  ? 'ملاحظة: نمط الوصول مضبوط حالياً على «متاح لكل الملتحقين بالمترو» من تبويب «التسجيل والوصول»، لذا يظهر المقرر للجميع بغض النظر عن هذا التحديد.'
                  : 'ملاحظة: نمط الوصول مضبوط حالياً على «مخفي — عبر المجموعات والأعضاء المسجلين فقط» من تبويب «التسجيل والوصول»، ولن يظهر المقرر في الكتالوج العام.'}
              </div>
            )}

            {/* B. Target Departments / Sectors */}
            <AudienceSectionCard
              title="القطاعات والإدارات المستهدفة"
              description="تحديد القطاعات والإدارات التنظيمية المؤهلة للدورة"
              summaryText={
                (course.targetDepartmentIds || []).length > 0
                  ? `${(course.targetDepartmentIds || []).length} قطاعاً محدداً`
                  : 'لم يتم تحديد قطاعات'
              }
              hasSelection={(course.targetDepartmentIds || []).length > 0}
              isExpanded={expandedAudience.departments}
              onToggleExpand={() => toggleAudienceExpand('departments')}
              onEdit={() => setActiveAudienceModal('departments')}
              toggleTestId="toggle-audience-departments"
              editTestId="edit-audience-departments-btn"
            >
              {(course.targetDepartmentIds || []).length === 0 ? (
                <p className="text-xs text-text-muted">لم يتم تحديد أي قطاع أو إدارة بعد.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(course.targetDepartmentIds || []).map((id) => (
                    <Badge key={id} variant="neutral" size="sm">
                      {deptNameById.get(id) || `#${id}`}
                    </Badge>
                  ))}
                </div>
              )}
            </AudienceSectionCard>

            {/* D. Target Job Titles (DB Catalog) */}
            <AudienceSectionCard
              title="المسميات الوظيفية المستهدفة"
              description="اختيار المسميات الوظيفية من دليل الوظائف بقاعدة البيانات"
              summaryText={
                (course.targetJobTitleIds || []).length > 0
                  ? `${(course.targetJobTitleIds || []).length} مسمى وظيفياً`
                  : 'لم يتم تحديد مسميات'
              }
              hasSelection={(course.targetJobTitleIds || []).length > 0}
              isExpanded={expandedAudience.jobTitles}
              onToggleExpand={() => toggleAudienceExpand('jobTitles')}
              onEdit={() => setActiveAudienceModal('jobTitles')}
              toggleTestId="toggle-audience-job-titles"
              editTestId="edit-audience-job-titles-btn"
            >
              {(course.targetJobTitleIds || []).length === 0 ? (
                <p className="text-xs text-text-muted">لم يتم تحديد أي مسمى وظيفي بعد.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(course.targetJobTitleIds || []).map((id) => (
                    <Badge key={id} variant="neutral" size="sm">
                      {jobNameById.get(id) || `#${id}`}
                    </Badge>
                  ))}
                </div>
              )}
            </AudienceSectionCard>

            {/* E. Target Metro Lines */}
            <AudienceSectionCard
              title="خطوط المترو المستهدفة"
              description="تحديد خطوط التشغيل المستهدفة للدورة التدريبية"
              summaryText={
                (course.targetMetroLineIds || []).length > 0
                  ? (course.targetMetroLineIds || []).length <= 2
                    ? (course.targetMetroLineIds || [])
                        .map((id) => lineNameById.get(id) || `#${id}`)
                        .join('، ')
                    : `${(course.targetMetroLineIds || []).length} خطوط محددة`
                  : 'لم يتم تحديد خطوط'
              }
              hasSelection={(course.targetMetroLineIds || []).length > 0}
              isExpanded={expandedAudience.metroLines}
              onToggleExpand={() => toggleAudienceExpand('metroLines')}
              onEdit={() => setActiveAudienceModal('metroLines')}
              toggleTestId="toggle-audience-metro-lines"
              editTestId="edit-audience-metro-lines-btn"
            >
              {(course.targetMetroLineIds || []).length === 0 ? (
                <p className="text-xs text-text-muted">لم يتم تحديد أي خط مترو بعد.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(course.targetMetroLineIds || []).map((id) => (
                    <Badge key={id} variant="neutral" size="sm">
                      {lineNameById.get(id) || `#${id}`}
                    </Badge>
                  ))}
                </div>
              )}
            </AudienceSectionCard>

            {/* F. Target Leadership / Supervisory Titles */}
            <AudienceSectionCard
              title="الصفات القيادية / الإشرافية المستهدفة"
              description="تحديد الصفات القيادية المستهدفة (اختياري — اتركها فارغة لإتاحة الدورة للجميع)"
              summaryText={
                (course.targetLeadershipTitles || []).length > 0
                  ? (course.targetLeadershipTitles || []).length <= 2
                    ? (course.targetLeadershipTitles || []).join('، ')
                    : `${(course.targetLeadershipTitles || []).length} صفات قيادية محددة`
                  : 'متاح للجميع'
              }
              hasSelection={(course.targetLeadershipTitles || []).length > 0}
              isExpanded={expandedAudience.leadership}
              onToggleExpand={() => toggleAudienceExpand('leadership')}
              onEdit={() => setActiveAudienceModal('leadership')}
              toggleTestId="toggle-audience-leadership"
              editTestId="edit-audience-leadership-btn"
            >
              {(course.targetLeadershipTitles || []).length === 0 ? (
                <p className="text-xs text-text-muted">لم يتم تحديد أي صفة قيادية بعد (متاح للجميع).</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(course.targetLeadershipTitles || []).map((lt) => (
                    <Badge key={lt} variant="warning" size="sm">
                      {lt}
                    </Badge>
                  ))}
                </div>
              )}
            </AudienceSectionCard>
          </div>

          <AudienceSelectionModal
            isOpen={activeAudienceModal === 'departments'}
            title="تحديد القطاعات والإدارات المستهدفة"
            description="اختر الإدارات والقطاعات التي يحق لمنتسبيها رؤية هذه الدورة."
            items={orgDepartments.map((d) => ({ id: d.id, label: d.nameAr }))}
            selectedIds={course.targetDepartmentIds || []}
            onSave={(nextIds) => handleSaveAudienceIds('targetDepartmentIds', nextIds)}
            onClose={() => setActiveAudienceModal(null)}
            searchPlaceholder="ابحث عن قطاع أو إدارة..."
            dataTestId="audience-departments-modal"
          />

          <AudienceSelectionModal
            isOpen={activeAudienceModal === 'jobTitles'}
            title="تحديد المسميات الوظيفية المستهدفة"
            description="اختر المسميات الوظيفية المستهدفة من دليل الوظائف."
            items={orgJobTitles.map((j) => ({
              id: j.id,
              label: j.nameAr,
              subtitle: j.departmentId ? deptNameById.get(j.departmentId) : undefined,
            }))}
            selectedIds={course.targetJobTitleIds || []}
            onSave={(nextIds) => handleSaveAudienceIds('targetJobTitleIds', nextIds)}
            onClose={() => setActiveAudienceModal(null)}
            searchPlaceholder="ابحث عن مسمى وظيفي..."
            dataTestId="audience-job-titles-modal"
          />

          <AudienceSelectionModal
            isOpen={activeAudienceModal === 'metroLines'}
            title="تحديد خطوط المترو المستهدفة"
            description="اختر خطوط المترو المستهدفة لهذه الدورة."
            items={orgMetroLines.map((l) => ({ id: l.id, label: l.nameAr }))}
            selectedIds={course.targetMetroLineIds || []}
            onSave={(nextIds) => handleSaveAudienceIds('targetMetroLineIds', nextIds)}
            onClose={() => setActiveAudienceModal(null)}
            searchPlaceholder="ابحث عن خط مترو..."
            dataTestId="audience-metro-lines-modal"
          />

          <AudienceSelectionModal
            isOpen={activeAudienceModal === 'leadership'}
            title="تحديد الصفات القيادية / الإشرافية المستهدفة"
            description="اختر الصفات القيادية المستهدفة لهذه الدورة، أو اتركها فارغة لإتاحتها للجميع."
            items={orgLeadershipTitles}
            selectedIds={orgLeadershipTitles
              .filter((opt) => (course.targetLeadershipTitles || []).includes(opt.label))
              .map((opt) => opt.id)}
            onSave={(nextIds) => {
              const titles = orgLeadershipTitles
                .filter((opt) => nextIds.includes(opt.id))
                .map((opt) => opt.label);
              onChange({ ...course, targetLeadershipTitles: titles });
              setActiveAudienceModal(null);
            }}
            onClose={() => setActiveAudienceModal(null)}
            searchPlaceholder="ابحث عن صفة قيادية..."
            dataTestId="audience-leadership-modal"
          />
        </div>
      </section>
      </>
      )}

      {/* ======================================================== */}
      {/* Section C — Prerequisites (Single Card with 2 Subsections)*/}
      {/* ======================================================== */}
      {showRequirements && (
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-6"
        data-testid="prerequisites-section"
        aria-labelledby="section-c-heading"
      >
        <SectionHeader
          icon="bookOpen"
          title="متطلبات ومقدمات الالتحاق بالمقرر"
          subtitle="حدد المتطلبات المعرفية الحرة والمقررات السابقة المعتمدة بشكل مستقل"
        />

        {/* Subsection 1: Knowledge and Skill Prerequisites */}
        <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-surface/50 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-text-heading">
              1. المتطلبات المعرفية والمهارية المسبقة (نص حر — وسوم قابلة للتعديل)
            </label>
            <span className="text-[11px] text-text-muted font-medium bg-surface px-2.5 py-0.5 rounded-full border border-border/70">
              غير مقيدة بقائمة محددة
            </span>
          </div>

          <p className="text-[11px] text-text-muted leading-relaxed">
            * تنويه: هذه المتطلبات مخصصة لتوجيه المتدرب وإرشاده (مثل: أساسيات جافا، مبادئ قواعد البيانات) ولا تمنعه آلياً من التسجيل.
          </p>

          {/* Chips list */}
          <div className="flex flex-wrap items-center gap-2" data-testid="knowledge-prereq-chips">
            {(course.knowledgePrerequisites || []).map((req, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border text-xs text-text-heading shadow-2xs"
                data-testid={`knowledge-prereq-chip-${idx}`}
              >
                {editingKnowledgeIdx === idx ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={editingKnowledgeText}
                      onChange={(e) => setEditingKnowledgeText(e.target.value)}
                      className="px-2 py-0.5 text-xs bg-bg-alt border border-primary rounded font-medium"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEditKnowledge(idx)}
                      className="text-success font-bold text-xs hover:opacity-80 px-1"
                      title="حفظ التعديل"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKnowledgeIdx(null)}
                      className="text-text-muted text-xs hover:text-text px-1"
                      title="إلغاء"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="font-medium">{req}</span>
                    <button
                      type="button"
                      onClick={() => handleStartEditKnowledge(idx, req)}
                      className="text-text-muted hover:text-primary p-0.5"
                      title="تعديل هذا المتطلب"
                      data-testid={`edit-knowledge-btn-${idx}`}
                    >
                      <Icon name="edit" size="sm" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveKnowledgePrereq(idx)}
                      className="text-text-muted hover:text-danger font-bold text-xs p-0.5"
                      title="حذف هذا المتطلب"
                      data-testid={`remove-knowledge-btn-${idx}`}
                    >
                      ✕
                    </button>
                  </>
                )}
              </span>
            ))}
          </div>

          {/* Add form */}
          <form onSubmit={handleAddKnowledgePrereq} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newKnowledgePrereq}
              onChange={(e) => setNewKnowledgePrereq(e.target.value)}
              placeholder="مثال: أساسيات لغة جافا، مبادئ قواعد البيانات SQL، إحصاء أساسي..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="knowledge-prereq-input"
            />
            <button
              type="submit"
              disabled={!newKnowledgePrereq.trim()}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-border bg-white hover:bg-neutral-light disabled:opacity-40 transition-colors shadow-2xs"
              data-testid="add-knowledge-prereq-btn"
            >
              + إضافة متطلب معرفي
            </button>
          </form>
        </div>

        {/* Subtle internal divider between subsections */}
        <div className="border-t border-border/70" />

        {/* Subsection 2: Course Prerequisites (Multiple Course Selector) */}
        <div className="p-4 sm:p-5 rounded-xl border border-border/80 bg-surface/50 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-text-heading">
              2. المقررات السابقة المعتمدة المطلوبة (اختيار متعدد)
            </label>
            <span className="text-[11px] text-text-muted font-medium bg-surface px-2.5 py-0.5 rounded-full border border-border/70">
              مقررات من دليل النظام
            </span>
          </div>

          {/* Selected courses chips */}
          <div className="space-y-2" data-testid="selected-prereq-courses">
            {currentPrereqCourseIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {currentPrereqCourseIds.map((cId) => {
                  const found = availableCourses.find((c) => c.id === cId);
                  return (
                    <span
                      key={cId}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-primary/40 text-xs text-text-heading shadow-2xs"
                      data-testid={`prereq-course-chip-${cId}`}
                    >
                      <Badge variant="primary" className="font-mono text-[10px]">
                        {cId}
                      </Badge>
                      <span className="font-semibold truncate max-w-xs">
                        {found ? found.title : cId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePrereqCourse(cId)}
                        className="text-text-muted hover:text-danger font-bold text-xs p-0.5"
                        title="إزالة المقرر كمتطلب سابق"
                        data-testid={`remove-prereq-course-${cId}`}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">
                لا توجد مقررات تدريبية سابقة مشروطة — هذا المقرر متاح للالتحاق المباشر.
              </p>
            )}
          </div>

          {/* Dropdown to add another course */}
          <div className="flex items-center gap-2 pt-1">
            <StyledSelect
              id="builder-prereq-select"
              dataTestId="builder-prereq-select"
              size="sm"
              className="flex-1"
              buttonClassName="bg-surface"
              value={selectedCourseToAdd}
              onChange={(val) => setSelectedCourseToAdd(val)}
              placeholder="اختر مقرراً تدريبياً لإضافته كمتطلب سابق..."
              emptyMessage="لا توجد مقررات أخرى متاحة"
              options={[
                { value: '', label: 'اختر مقرراً تدريبياً لإضافته كمتطلب سابق...' },
                ...availableCourses
                  .filter((c) => c.id !== course.id && !currentPrereqCourseIds.includes(c.id))
                  .map((c) => ({
                    value: c.id,
                    label: `${c.id}: ${c.title}`,
                  })),
              ]}
            />
            <button
              type="button"
              onClick={() => handleAddPrereqCourse(selectedCourseToAdd)}
              disabled={!selectedCourseToAdd}
              className="px-4 py-2.5 text-xs font-bold rounded-xl border border-border bg-white hover:bg-neutral-light disabled:opacity-40 transition-colors shadow-2xs"
              data-testid="add-prereq-course-btn"
            >
              + إضافة للمتطلبات
            </button>
          </div>
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* Section D — Course Cover and Visual Identity             */}
      {/* ======================================================== */}
      {showBasic && (
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="cover-settings-section"
        aria-labelledby="section-d-heading"
      >
        <SectionHeader
          icon="palette"
          title="غلاف المقرر والهوية البصرية"
          subtitle="صورة الغلاف اختيارية تماماً. يمكنك استخدام صورة، لون معتمد من هوية المترو، أو الغلاف الافتراضي"
        />

        {/* Cover Mode Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-surface border border-border w-fit">
          <button
            type="button"
            onClick={() => handleSelectCoverMode('image')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              coverType === 'image'
                ? 'bg-white text-primary shadow-xs border border-primary/20 ring-1 ring-primary/20'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="cover-mode-image-btn"
          >
            صورة مخصصة
          </button>
          <button
            type="button"
            onClick={() => handleSelectCoverMode('color')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              coverType === 'color'
                ? 'bg-white text-primary shadow-xs border border-primary/20 ring-1 ring-primary/20'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="cover-mode-color-btn"
          >
            لون مميز من هوية المترو
          </button>
          <button
            type="button"
            onClick={() => handleSelectCoverMode('default')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              coverType === 'default'
                ? 'bg-white text-primary shadow-xs border border-primary/20 ring-1 ring-primary/20'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="cover-mode-default-btn"
          >
            الغلاف الافتراضي
          </button>
        </div>

        {/* Cover Preview and Controls Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-xl border border-border/70 bg-surface/40 items-center">
          {/* Live Preview Box */}
          <div className="md:col-span-1 space-y-2">
            <span className="text-[11px] font-bold text-text-muted block">معاينة الغلاف الحالية:</span>
            <div
              className="w-full h-36 rounded-xl border border-border overflow-hidden relative flex flex-col justify-between p-3.5 shadow-inner"
              style={{
                backgroundColor:
                  coverType === 'color' && course.coverColor
                    ? course.coverColor
                    : coverType === 'default'
                    ? '#003366'
                    : undefined,
              }}
              data-testid="cover-preview-box"
            >
              {coverType === 'image' && course.thumbnail ? (
                <img
                  src={course.thumbnail}
                  alt={course.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}

              {/* Overlay with Metro Star Emblem branding */}
              <div className="relative z-10 flex items-center justify-between">
                <Badge variant="primary" className="text-[10px] bg-black/40 text-white border-white/20">
                  {course.level}
                </Badge>
                <span className="text-[10px] text-white/80 font-mono font-bold">
                  {course.id}
                </span>
              </div>

              <div className="relative z-10">
                <h4 className="text-xs font-bold text-white drop-shadow truncate">
                  {course.title || 'عنوان المقرر التدريبي'}
                </h4>
                <p className="text-[10px] text-white/80 truncate">
                  {course.lecturerName}
                </p>
              </div>
            </div>
          </div>

          {/* Contextual Controls Based on Cover Mode */}
          <div className="md:col-span-2 space-y-4">
            {coverType === 'image' && (
              <div className="space-y-3" data-testid="cover-image-controls">
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="builder-cover-upload"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-white text-xs font-bold text-primary hover:bg-neutral-light cursor-pointer transition-colors shadow-2xs"
                  >
                    <Icon name="upload" size="sm" />
                    <span>{course.thumbnail ? 'استبدال صورة الغلاف' : 'اختيار صورة غلاف جديدة'}</span>
                  </label>
                  <input
                    id="builder-cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                    data-testid="builder-cover-upload"
                  />

                  {course.thumbnail && (
                    <button
                      type="button"
                      onClick={handleRemoveCoverImage}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 text-xs font-bold transition-colors"
                      data-testid="remove-cover-image-btn"
                    >
                      <span>✕ حذف الصورة المخصصة</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-text-muted leading-relaxed">
                  * صورة الغلاف اختيارية بالكامل. في حال حذفها، يعود المقرر للون المعتمد أو الغلاف الافتراضي دون أي فراغ أو صورة تالفة. يتم حفظ الصورة محلياً في ذاكرة المتصفح النشطة.
                </p>
              </div>
            )}

            {coverType === 'color' && (
              <div className="space-y-3" data-testid="cover-color-controls">
                <span className="text-xs font-bold text-text-heading block">
                  اختر لوناً رئيسياً من الهوية البصرية لمترو القاهرة:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BRAND_COVER_COLORS.map((col) => {
                    const isSelected = (course.coverColor || '#003366') === col.id;
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => handleSelectCoverColor(col.id)}
                        className={`p-2 rounded-xl border text-right flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                            : 'border-border bg-white hover:bg-neutral-light'
                        }`}
                        data-testid={`color-choice-${col.id}`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full shrink-0 shadow-2xs border border-white/40 ${col.bgClass}`}
                        />
                        <span className="text-[11px] font-semibold text-text truncate">
                          {col.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {coverType === 'default' && (
              <div className="space-y-2 text-xs text-text-muted" data-testid="cover-default-notice">
                <p className="leading-relaxed">
                  يستخدم هذا الخيار الغلاف المؤسسي الموحد لمترو القاهرة بنمط التدرج الكحلي الهندسي مع شعار نجمة المترو.
                </p>
                <p className="text-[11px] text-text-muted/80">
                  لا يتطلب رفع أي ملفات وسيكون متوافقاً مع كافة الشاشات وأجهزة الععرض.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* Section E — Course-Level External Resources Section       */}
      {/* ======================================================== */}
      {showRequirements && (
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="course-resources-section"
        aria-labelledby="section-e-heading"
      >
        <SectionHeader
          icon="library"
          title="المصادر والمراجع الخارجية للمقرر"
          subtitle="روابط ومراجع إثرائية عامة تدعم دراسة المقرر التدريبي ككل مع إمكانية إنشاء وتنزيل رموز QR المباشرة"
        />

        <div>
          <ExternalResourcesEditor
            resources={course.externalResources || []}
            onChange={(updated) => handleFieldChange('externalResources', updated)}
            scopeLabel="للمقرر التدريبي ككل"
          />
        </div>
      </section>
      )}

      {/* ======================================================== */}
      {/* Section F — Course WhatsApp Contacts & Override Section   */}
      {/* ======================================================== */}
      {showTeam && (
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="course-whatsapp-contacts-section"
        aria-labelledby="section-f-heading"
      >
        <SectionHeader
          icon="messageCircle"
          iconNode={<WhatsAppBrandIcon className="w-5 h-5" />}
          iconWrapperClassName="bg-success/10 text-success border border-success/20"
          title="أرقام واتساب للتواصل ودعم المقرر"
          subtitle="تخصيص أرقام التواصل عبر واتساب لصفحة المقرر مع التوريث التلقائي من حساب المحاضر المسجل"
          badge={
            hasWhatsAppOverride ? (
              <Badge variant="warning" size="sm">
                تم تفعيل التخصيص للمقرر
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                تلقائي (حساب المحاضر المسجل)
              </Badge>
            )
          }
        />

        <div className="space-y-4">
          {!hasWhatsAppOverride ? (
            <div className="p-4 rounded-xl bg-bg-alt/60 border border-border space-y-3" data-testid="wa-inherited-info">
              <div className="flex items-center gap-2 text-xs font-bold text-text-heading">
                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="refresh" size="sm" />
                </span>
                <span>حالة التوريث الحالية:</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                يتم تلقائياً استخدام رقم الهاتف المسجل في الحساب الشخصي للمحاضر <strong className="text-text-heading">({course.lecturerName})</strong> للتواصل المباشر مع المتدربين.
              </p>
              {effectiveIsAdmin ? (
                <div className="pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnableOverride}
                    className="text-xs font-bold border-primary/40 text-primary bg-surface hover:bg-primary/10 hover:border-primary shadow-2xs"
                    data-testid="btn-enable-wa-override"
                  >
                    <Icon name="plus" size="sm" className="ml-1.5" />
                    <span>تخصيص أرقام واتساب لهذا المقرر (تجاوز افتراضي)</span>
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted italic pt-2 border-t border-border/70" data-testid="wa-lecturer-readonly-notice">
                  ملاحظة: تعديل وتخصيص أرقام واتساب للمقرر مقتصر على مدير النظام فقط.
                </p>
              )}
            </div>
          ) : effectiveIsAdmin ? (
            <div className="space-y-3" data-testid="wa-override-controls">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="phone" size="sm" className="text-success" />
                  أرقام التواصل المخصصة لهذا المقرر:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearOverride}
                  className="text-xs font-bold border-danger/40 text-danger bg-surface hover:bg-danger/10 hover:border-danger self-start sm:self-auto"
                  data-testid="btn-clear-wa-override"
                >
                  <Icon name="rotateCcw" size="sm" className="ml-1.5" />
                  <span>إلغاء التخصيص والعودة للرقم المسجل للمحاضر</span>
                </Button>
              </div>

              <div className="space-y-2.5">
                {(course.whatsappContacts || []).map((contact, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center p-3 rounded-xl border border-border bg-bg-alt/40"
                    data-testid={`wa-override-item-${idx}`}
                  >
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => handleUpdateContact(idx, 'name', e.target.value)}
                      placeholder="اسم جهة الاتصال"
                      className="w-full sm:flex-1 px-3 py-2 text-xs bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      data-testid={`wa-contact-name-input-${idx}`}
                    />
                    <input
                      type="tel"
                      inputMode="tel"
                      maxLength={15}
                      dir="ltr"
                      value={contact.number}
                      onChange={(e) => handleUpdateContact(idx, 'number', sanitizePhoneInput(e.target.value, 15))}
                      placeholder="رقم الهاتف (مثال: 01012345678)"
                      className="w-full sm:flex-1 px-3 py-2 text-xs font-mono text-right bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      data-testid={`wa-contact-number-input-${idx}`}
                    />
                    <input
                      type="text"
                      value={contact.role || ''}
                      onChange={(e) => handleUpdateContact(idx, 'role', e.target.value)}
                      placeholder="الصفة (مثال: محاضر المقرر)"
                      className="w-full sm:flex-1 px-3 py-2 text-xs bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      data-testid={`wa-contact-role-input-${idx}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveContact(idx)}
                      className="text-danger border-danger/30 bg-surface hover:bg-danger/10 hover:border-danger/60 px-2.5 shrink-0 self-end sm:self-auto"
                      data-testid={`btn-remove-wa-contact-${idx}`}
                      title="حذف الرقم"
                      aria-label="حذف الرقم"
                    >
                      <Icon name="trash" size="sm" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddContact}
                  className="text-xs font-bold border-primary/40 text-primary bg-surface hover:bg-primary/10 hover:border-primary"
                  data-testid="btn-add-wa-contact"
                >
                  <Icon name="plus" size="sm" className="ml-1.5" />
                  <span>إضافة رقم تواصل آخر</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3" data-testid="wa-override-readonly-list">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="phone" size="sm" className="text-success" />
                  أرقام التواصل المعتمدة من الإدارة لهذا المقرر:
                </span>
                <Badge variant="warning" size="sm">
                  مخصص من قبل الإدارة (للقراءة فقط)
                </Badge>
              </div>

              <div className="space-y-2">
                {(course.whatsappContacts || []).map((contact, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 rounded-xl border border-border bg-bg-alt/60"
                    data-testid={`wa-override-item-${idx}`}
                  >
                    <span className="text-xs font-bold text-text-heading flex-1 flex items-center gap-1.5" data-testid={`wa-contact-name-${idx}`}>
                      <Icon name="user" size="sm" className="text-primary" />
                      {contact.name}
                    </span>
                    <span className="text-xs font-mono text-text-muted flex-1 flex items-center gap-1.5" dir="ltr" data-testid={`wa-contact-number-${idx}`}>
                      <Icon name="phone" size="sm" className="text-success" />
                      {contact.number}
                    </span>
                    <Badge variant="neutral" size="sm">
                      {contact.role || 'دعم المقرر'}
                    </Badge>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-text-muted italic pt-2 border-t border-border/70" data-testid="wa-lecturer-readonly-notice">
                ملاحظة: تعديل وتخصيص أرقام واتساب للمقرر مقتصر على مدير النظام فقط.
              </p>
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  );
};

export default MetadataEditor;
