import React, { useState } from 'react';
import type { Course, CourseLevel } from '@/core/courses/types';
import { Badge } from '@/shared/ui/Badge';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { ExternalResourcesEditor } from '@/features/courses/components/ExternalResourcesEditor';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { INITIAL_MANAGED_USERS } from '@/mocks/fixtures/userDirectoryFixtures';

export interface MetadataEditorProps {
  course: Course;
  onChange: (updatedCourse: Course) => void;
  availableCourses?: Course[];
  availableLecturers?: Array<{ id: string; name: string; email?: string; phone?: string; department?: string }>;
  isAdmin?: boolean;
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
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, subtitle, badge }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/70 gap-3">
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon name={icon} size="sm" />
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
}) => {
  const { user } = useAuth();
  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : user?.role === 'admin';

  const defaultLecturers = INITIAL_MANAGED_USERS.filter((u) => u.role === 'lecturer').map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    department: u.department,
  }));

  const lecturersList =
    availableLecturers && availableLecturers.length > 0 ? availableLecturers : defaultLecturers;

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

  // Target Jobs State
  const [newJobTitle, setNewJobTitle] = useState('');

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
  const handleAddJobTitle = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newJobTitle.trim();
    if (!clean) return;
    const current = course.targetJobTitles || [];
    if (!current.includes(clean)) {
      handleFieldChange('targetJobTitles', [...current, clean]);
    }
    setNewJobTitle('');
  };

  const handleRemoveJobTitle = (titleToRemove: string) => {
    const current = course.targetJobTitles || [];
    handleFieldChange(
      'targetJobTitles',
      current.filter((t) => t !== titleToRemove)
    );
  };

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

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
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
          <strong className="text-text-heading">{course.lecturerName}</strong>
        </div>
        <div className="flex items-center gap-4 text-text-muted">
          <span>المسجلين: <strong className="text-text-heading">{course.enrollmentCount || 0}</strong></span>
          <span>التقييم: <strong className="text-warning-dark">{course.rating || 0} ★</strong></span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Instructor Assignment & Governance Section               */}
      {/* ======================================================== */}
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
              <select
                id="select-primary-lecturer"
                value={course.lecturerId || ''}
                onChange={(e) => handlePrimaryLecturerChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                data-testid="select-primary-lecturer"
              >
                <option value="" disabled>
                  -- اختر المحاضر الرئيسي من دليل المحاضرين --
                </option>
                {lecturersList.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.name} ({lec.id}) {lec.department ? `— ${lec.department}` : ''}
                  </option>
                ))}
              </select>
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
                <select
                  value={selectedCoLecturerToAdd}
                  onChange={(e) => setSelectedCoLecturerToAdd(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid="select-add-co-lecturer"
                >
                  <option value="">-- اختر محاضراً مشاركاً لإضافته --</option>
                  {lecturersList
                    .filter((l) => l.id !== course.lecturerId && !(course.coLecturers || []).includes(l.id))
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.id})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCoLecturer}
                  disabled={!selectedCoLecturerToAdd}
                  className="btn btn-outline-primary btn-sm text-xs font-bold shrink-0 disabled:opacity-50"
                  data-testid="btn-add-co-lecturer"
                >
                  + إضافة محاضر مشارك
                </button>
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

      {/* ======================================================== */}
      {/* Section A — Basic Course Information                     */}
      {/* ======================================================== */}
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
              وصف المقرر وأهدافه التعليمية
            </label>
            <textarea
              id="builder-desc-input"
              rows={4}
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
                min={1}
                max={200}
                value={course.estimatedHours || 4}
                onChange={(e) => handleFieldChange('estimatedHours', Number(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                data-testid="builder-hours-input"
              />
            </div>
          </div>

          {/* Target Job Titles (Chips) */}
          <div className="space-y-2 pt-3 border-t border-border/60">
            <label className="block text-xs font-bold text-text-heading">
              الفئات والوظائف المستهدفة
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {(course.targetJobTitles || []).map((job) => (
                <span
                  key={job}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-light text-text-heading border border-border text-xs font-medium"
                >
                  <span>{job}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveJobTitle(job)}
                    className="text-text-muted hover:text-danger font-bold text-xs p-0.5"
                    title="حذف الفئة"
                    aria-label={`حذف الفئة ${job}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddJobTitle} className="flex items-center gap-2">
              <input
                type="text"
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
                placeholder="مثال: فني صيانة قطارات، سائق قطار، مهندس إشارات..."
                className="flex-1 px-3.5 py-2.5 text-xs bg-surface border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                data-testid="builder-job-title-input"
              />
              <button
                type="submit"
                disabled={!newJobTitle.trim()}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-border bg-surface hover:bg-neutral-light disabled:opacity-40 transition-colors"
                data-testid="builder-add-job-title-btn"
              >
                + إضافة فئة
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* Section C — Prerequisites (Single Card with 2 Subsections)*/}
      {/* ======================================================== */}
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
            <select
              id="builder-prereq-select"
              value={selectedCourseToAdd}
              onChange={(e) => setSelectedCourseToAdd(e.target.value)}
              className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              data-testid="builder-prereq-select"
            >
              <option value="">اختر مقرراً تدريبياً لإضافته كمتطلب سابق...</option>
              {availableCourses
                .filter(
                  (c) => c.id !== course.id && !currentPrereqCourseIds.includes(c.id)
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}: {c.title}
                  </option>
                ))}
            </select>
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

      {/* ======================================================== */}
      {/* Section D — Course Cover and Visual Identity             */}
      {/* ======================================================== */}
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

      {/* ======================================================== */}
      {/* Section E — Course-Level External Resources Section       */}
      {/* ======================================================== */}
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="course-resources-section"
        aria-labelledby="section-e-heading"
      >
        <SectionHeader
          icon="externalLink"
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

      {/* ======================================================== */}
      {/* Section F — Course WhatsApp Contacts & Override Section   */}
      {/* ======================================================== */}
      <section
        className="bg-surface rounded-2xl border border-border p-6 shadow-xs space-y-5"
        data-testid="course-whatsapp-contacts-section"
        aria-labelledby="section-f-heading"
      >
        <SectionHeader
          icon="externalLink"
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
            <div className="p-4 rounded-xl bg-neutral-light border border-border space-y-3" data-testid="wa-inherited-info">
              <div className="flex items-center gap-2 text-xs font-bold text-text-heading">
                <span>🔄 حالة التوريث الحالية:</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                يتم تلقائياً استخدام رقم الهاتف المسجل في الحساب الشخصي للمحاضر <strong>({course.lecturerName})</strong> للتواصل المباشر مع المتدربين.
              </p>
              {effectiveIsAdmin ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleEnableOverride}
                    className="btn btn-outline-primary btn-sm inline-flex items-center gap-1.5 text-xs font-bold"
                    data-testid="btn-enable-wa-override"
                  >
                    <span>+ تخصيص أرقام واتساب لهذا المقرر (تجاوز افتراضي)</span>
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted italic pt-2 border-t border-border/70" data-testid="wa-lecturer-readonly-notice">
                  ملاحظة: تعديل وتخصيص أرقام واتساب للمقرر مقتصر على مدير النظام فقط.
                </p>
              )}
            </div>
          ) : effectiveIsAdmin ? (
            <div className="space-y-3" data-testid="wa-override-controls">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-heading">
                  أرقام التواصل المخصصة لهذا المقرر:
                </span>
                <button
                  type="button"
                  onClick={handleClearOverride}
                  className="btn btn-outline-danger btn-sm text-xs font-bold"
                  data-testid="btn-clear-wa-override"
                >
                  <span>إلغاء التخصيص والعودة للرقم المسجل للمحاضر</span>
                </button>
              </div>

              <div className="space-y-2">
                {(course.whatsappContacts || []).map((contact, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row gap-2 items-center p-3 rounded-xl border border-border bg-white"
                    data-testid={`wa-override-item-${idx}`}
                  >
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => handleUpdateContact(idx, 'name', e.target.value)}
                      placeholder="اسم جهة الاتصال"
                      className="input input-sm flex-1 text-xs"
                      data-testid={`wa-contact-name-input-${idx}`}
                    />
                    <input
                      type="text"
                      value={contact.number}
                      onChange={(e) => handleUpdateContact(idx, 'number', e.target.value)}
                      placeholder="رقم الهاتف (مثال: 01012345678)"
                      className="input input-sm flex-1 text-xs"
                      data-testid={`wa-contact-number-input-${idx}`}
                    />
                    <input
                      type="text"
                      value={contact.role || ''}
                      onChange={(e) => handleUpdateContact(idx, 'role', e.target.value)}
                      placeholder="الصفة (مثال: محاضر المقرر)"
                      className="input input-sm flex-1 text-xs"
                      data-testid={`wa-contact-role-input-${idx}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(idx)}
                      className="btn btn-ghost btn-sm text-danger hover:bg-danger/10 text-xs px-2"
                      data-testid={`btn-remove-wa-contact-${idx}`}
                      title="حذف"
                    >
                      <span>✕</span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddContact}
                className="btn btn-outline-primary btn-sm inline-flex items-center gap-1.5 text-xs font-bold mt-2"
                data-testid="btn-add-wa-contact"
              >
                <span>+ إضافة رقم تواصل آخر</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3" data-testid="wa-override-readonly-list">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-heading">
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
                    className="flex flex-col sm:flex-row gap-2 items-center p-3 rounded-xl border border-border bg-neutral-light"
                    data-testid={`wa-override-item-${idx}`}
                  >
                    <span className="text-xs font-bold text-text-heading flex-1" data-testid={`wa-contact-name-${idx}`}>
                      {contact.name}
                    </span>
                    <span className="text-xs font-mono text-text-muted flex-1" data-testid={`wa-contact-number-${idx}`}>
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
    </div>
  );
};

export default MetadataEditor;
