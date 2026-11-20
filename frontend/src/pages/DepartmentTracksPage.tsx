import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import {
  departmentTracksApi,
  type CourseVisibilityItem,
  type OrgDepartmentOption,
  type OrgJobTitleOption,
} from '@/features/permissions/services/departmentTracksApi';

type VisibilityViewMode = 'by_course' | 'by_department' | 'by_job_title' | 'by_leadership';

const DEFAULT_LEADERSHIP_TITLES = [
  'رئيس قطاع / رئيس إدارة مركزية',
  'مدير عام',
  'مدير إدارة',
  'رئيس قسم / رئيس وحدة',
  'مشرف / رئيس وردية',
  'قائد فريق / منسق',
];

export const DepartmentTracksPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courses, setCourses] = useState<CourseVisibilityItem[]>([]);
  const [departments, setDepartments] = useState<OrgDepartmentOption[]>([]);
  const [jobTitles, setJobTitles] = useState<OrgJobTitleOption[]>([]);
  const [leadershipTitles, setLeadershipTitles] = useState<string[]>(DEFAULT_LEADERSHIP_TITLES);

  const [viewMode, setViewMode] = useState<VisibilityViewMode>('by_course');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal 1: Edit visibility for a specific course
  const [editingCourse, setEditingCourse] = useState<CourseVisibilityItem | null>(null);
  const [modalDeptIds, setModalDeptIds] = useState<string[]>([]);
  const [modalJobIds, setModalJobIds] = useState<string[]>([]);
  const [modalLeadershipTitles, setModalLeadershipTitles] = useState<string[]>([]);
  const [modalScopeSearch, setModalScopeSearch] = useState('');
  const [modalActiveTab, setModalActiveTab] = useState<'departments' | 'job_titles' | 'leadership'>('departments');
  const [isSaving, setIsSaving] = useState(false);

  // Modal 2: Edit courses for a specific department, job title, or leadership title
  const [editingScope, setEditingScope] = useState<{
    type: 'department' | 'job_title' | 'leadership';
    id: string;
    label: string;
  } | null>(null);
  const [modalCourseIds, setModalCourseIds] = useState<string[]>([]);
  const [modalCourseSearch, setModalCourseSearch] = useState('');

  const isAssistantAdmin = user?.role === 'assistant_admin';
  const isAdmin =
    user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'developer';
  const isAuthorized = isAdmin || isAssistantAdmin;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await departmentTracksApi.getCourseVisibilityCatalog();
      setCourses(data.courses || []);
      setDepartments(data.departments || []);
      setJobTitles(data.jobTitles || []);
      if (data.leadershipTitles && data.leadershipTitles.length > 0) {
        setLeadershipTitles(data.leadershipTitles);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل إعدادات ظهور الكورسات.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.nameAr);
    return map;
  }, [departments]);

  const jobNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobTitles) map.set(j.id, j.nameAr);
    return map;
  }, [jobTitles]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.title.toLowerCase().includes(q));
  }, [courses, searchQuery]);

  const filteredDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) => d.nameAr.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q)
    );
  }, [departments, searchQuery]);

  const filteredJobTitles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobTitles;
    return jobTitles.filter(
      (j) =>
        j.nameAr.toLowerCase().includes(q) ||
        j.nameEn.toLowerCase().includes(q) ||
        (j.departmentNameAr || '').toLowerCase().includes(q)
    );
  }, [jobTitles, searchQuery]);

  // Open Course Visibility Modal
  const handleOpenCourseModal = (course: CourseVisibilityItem) => {
    setEditingCourse(course);
    setModalDeptIds([...course.targetDepartmentIds]);
    setModalJobIds([...course.targetJobTitleIds]);
    setModalLeadershipTitles([...(course.targetLeadershipTitles || [])]);
    setModalScopeSearch('');
    setModalActiveTab('departments');
  };

  const handleSaveCourseModal = async () => {
    if (!editingCourse) return;
    setIsSaving(true);
    try {
      const res = await departmentTracksApi.updateCourseVisibility(
        editingCourse.id,
        modalDeptIds,
        modalJobIds,
        modalLeadershipTitles
      );
      setCourses((prev) =>
        prev.map((c) =>
          c.id === editingCourse.id
            ? {
                ...c,
                targetDepartmentIds: res.targetDepartmentIds,
                targetJobTitleIds: res.targetJobTitleIds,
                targetLeadershipTitles: res.targetLeadershipTitles || modalLeadershipTitles,
              }
            : c
        )
      );
      toast.success(res.message || 'تم تحديث قواعد ظهور الدورة بنجاح.');
      setEditingCourse(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'تعذر حفظ إعدادات الظهور.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Scope Courses Modal (by Department, Job Title, or Leadership Title)
  const handleOpenScopeModal = (
    type: 'department' | 'job_title' | 'leadership',
    id: string,
    label: string
  ) => {
    const assigned = courses
      .filter((c) =>
        type === 'department'
          ? c.targetDepartmentIds.includes(id)
          : type === 'job_title'
            ? c.targetJobTitleIds.includes(id)
            : (c.targetLeadershipTitles || []).includes(id)
      )
      .map((c) => c.id);
    setEditingScope({ type, id, label });
    setModalCourseIds(assigned);
    setModalCourseSearch('');
  };

  const handleSaveScopeModal = async () => {
    if (!editingScope) return;
    setIsSaving(true);
    try {
      const res = await departmentTracksApi.updateScopeCourseVisibility(
        editingScope.type,
        editingScope.id,
        modalCourseIds
      );
      const selectedSet = new Set(res.courseIds);
      setCourses((prev) =>
        prev.map((c) => {
          if (editingScope.type === 'department') {
            const without = c.targetDepartmentIds.filter((x) => x !== editingScope.id);
            return {
              ...c,
              targetDepartmentIds: selectedSet.has(c.id) ? [...without, editingScope.id] : without,
            };
          }
          if (editingScope.type === 'job_title') {
            const without = c.targetJobTitleIds.filter((x) => x !== editingScope.id);
            return {
              ...c,
              targetJobTitleIds: selectedSet.has(c.id) ? [...without, editingScope.id] : without,
            };
          }
          const currentLead = c.targetLeadershipTitles || [];
          const without = currentLead.filter((x) => x !== editingScope.id);
          return {
            ...c,
            targetLeadershipTitles: selectedSet.has(c.id) ? [...without, editingScope.id] : without,
          };
        })
      );
      toast.success(res.message || 'تم حفظ تخصيص الكورسات بنجاح.');
      setEditingScope(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'تعذر حفظ التخصيص.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  if (!isAuthorized) {
    return (
      <div
        className="container mx-auto p-6 max-w-4xl text-right"
        data-testid="unauthorized-department-tracks-view"
      >
        <Alert
          type="error"
          title="غير مصرح بالوصول"
          message="هذه الصفحة مخصصة لمديري النظام والمساعدين الإداريين المصرح لهم فقط."
        />
      </div>
    );
  }

  return (
    <div
      role="main"
      data-testid="department-tracks-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-5 text-right"
      dir="rtl"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <button
              type="button"
              onClick={() => navigate('/admin/permissions')}
              className="hover:text-primary inline-flex items-center gap-1 cursor-pointer"
            >
              <Icon name="arrowRight" size="sm" />
              <span>الصلاحيات والحوكمة</span>
            </button>
            <span>/</span>
            <span className="text-primary font-semibold">ظهور الكورسات للإدارات والوظائف</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
              <Icon name="grid" size="lg" />
            </span>
            توجيه الكورسات للإدارات والمسميات الوظيفية
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            حدد بوضوح الكورسات التي تظهر في دليل الكورسات لكل إدارة ولكل مسمى وظيفي. (أي كورس غير مقيد يظهر تلقائياً للجميع).
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadData}
          isLoading={isLoading}
          data-testid="refresh-dept-tracks-btn"
        >
          <Icon name="rotateCcw" size="sm" className="ml-1.5" />
          تحديث
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="خطأ في تحميل البيانات">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadData}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Full-Width View Tabs & Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'by_course', label: `حسب الكورس (${courses.length})`, icon: 'courses' as const },
            {
              id: 'by_department',
              label: `حسب الإدارة (${departments.length})`,
              icon: 'trainingGroups' as const,
            },
            {
              id: 'by_job_title',
              label: `حسب المسمى الوظيفي (${jobTitles.length})`,
              icon: 'user' as const,
            },
            {
              id: 'by_leadership',
              label: `حسب الصفة القيادية (${leadershipTitles.length})`,
              icon: 'shield' as const,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setViewMode(tab.id as VisibilityViewMode);
                setSearchQuery('');
              }}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === tab.id
                  ? 'bg-primary-dark text-white shadow-xs'
                  : 'bg-bg text-text-muted hover:text-text hover:bg-bg-alt'
              }`}
              data-testid={`visibility-tab-${tab.id}`}
            >
              <Icon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              viewMode === 'by_course'
                ? 'بحث باسم الكورس...'
                : viewMode === 'by_department'
                  ? 'بحث باسم الإدارة...'
                  : 'بحث بالمسمى الوظيفي أو الإدارة...'
            }
            className="w-full text-xs pr-9 pl-3 py-2 bg-bg border border-border rounded-xl text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            data-testid="dept-search-input"
          />
          <Icon
            name="search"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
        </div>
      </div>

      {/* Main Full-Width Table Content */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center text-sm text-text-muted">
          جاري تحميل بيانات الكورسات والإدارات والمسميات الوظيفية...
        </div>
      ) : viewMode === 'by_course' ? (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm" data-testid="visibility-by-course-table">
              <thead className="bg-bg-alt/60 border-b border-border text-xs text-text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-4">الكورس</th>
                  <th className="py-3.5 px-3">الحالة</th>
                  <th className="py-3.5 px-3">الإدارات المسموح لها</th>
                  <th className="py-3.5 px-3">المسميات الوظيفية المسموح لها</th>
                  <th className="py-3.5 px-3">الصفات القيادية</th>
                  <th className="py-3.5 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-text-muted text-xs">
                      لا توجد كورسات مطابقة للبحث.
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-bg/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-text-heading">{c.title}</td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge
                          variant={c.lifecycleStatus === 'Published' ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {c.lifecycleStatus === 'Published' ? 'منشور' : 'مسودة'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3">
                        {c.targetDepartmentIds.length === 0 ? (
                          <Badge variant="primary" size="sm">
                            متاح لجميع الإدارات
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.targetDepartmentIds.map((did) => (
                              <Badge key={did} variant="neutral" size="sm">
                                {deptNameMap.get(did) || did}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {c.targetJobTitleIds.length === 0 ? (
                          <Badge variant="primary" size="sm">
                            متاح لجميع المسميات
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.targetJobTitleIds.map((jid) => (
                              <Badge key={jid} variant="info" size="sm">
                                {jobNameMap.get(jid) || jid}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {!c.targetLeadershipTitles || c.targetLeadershipTitles.length === 0 ? (
                          <Badge variant="neutral" size="sm">
                            متاح للجميع
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {c.targetLeadershipTitles.map((lt) => (
                              <Badge key={lt} variant="warning" size="sm">
                                {lt}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          leftIcon="edit"
                          onClick={() => handleOpenCourseModal(c)}
                          data-testid={`edit-course-visibility-btn-${c.id}`}
                        >
                          تحديد الظهور
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'by_department' ? (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm" data-testid="visibility-by-department-table">
              <thead className="bg-bg-alt/60 border-b border-border text-xs text-text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-4">الإدارة / القطاع</th>
                  <th className="py-3.5 px-3">الكورسات المخصصة لهذه الإدارة</th>
                  <th className="py-3.5 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-text-muted text-xs">
                      لا توجد إدارات مطابقة للبحث.
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((dept) => {
                    const assignedCourses = courses.filter((c) =>
                      c.targetDepartmentIds.includes(dept.id)
                    );
                    return (
                      <tr key={dept.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-text-heading">{dept.nameAr}</td>
                        <td className="py-3.5 px-3">
                          {assignedCourses.length === 0 ? (
                            <span className="text-xs text-text-muted">
                              لا توجد كورسات مخصصة خصيصاً (تظهر لها الكورسات العامة المفتوحة للجميع)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="success" size="sm">
                                {assignedCourses.length} كورس مخصص
                              </Badge>
                              {assignedCourses.slice(0, 4).map((c) => (
                                <Badge key={c.id} variant="neutral" size="sm">
                                  {c.title}
                                </Badge>
                              ))}
                              {assignedCourses.length > 4 && (
                                <Badge variant="neutral" size="sm">
                                  +{assignedCourses.length - 4} أخرى
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon="edit"
                            onClick={() =>
                              handleOpenScopeModal('department', dept.id, dept.nameAr)
                            }
                            data-testid={`edit-dept-courses-btn-${dept.id}`}
                          >
                            تعديل كورسات الإدارة
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'by_job_title' ? (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm" data-testid="visibility-by-job-table">
              <thead className="bg-bg-alt/60 border-b border-border text-xs text-text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-4">المسمى الوظيفي</th>
                  <th className="py-3.5 px-3">الإدارة التابعة</th>
                  <th className="py-3.5 px-3">الكورسات المخصصة لهذا المسمى</th>
                  <th className="py-3.5 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredJobTitles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-text-muted text-xs">
                      لا توجد مسميات وظيفية مطابقة للبحث.
                    </td>
                  </tr>
                ) : (
                  filteredJobTitles.map((job) => {
                    const assignedCourses = courses.filter((c) =>
                      c.targetJobTitleIds.includes(job.id)
                    );
                    return (
                      <tr key={job.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-text-heading">{job.nameAr}</td>
                        <td className="py-3.5 px-3 text-xs text-text-muted">
                          {job.departmentNameAr || 'عام / غير مقيد بإدارة'}
                        </td>
                        <td className="py-3.5 px-3">
                          {assignedCourses.length === 0 ? (
                            <span className="text-xs text-text-muted">
                              لا توجد كورسات مخصصة خصيصاً (تظهر له الكورسات العامة)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="info" size="sm">
                                {assignedCourses.length} كورس مخصص
                              </Badge>
                              {assignedCourses.slice(0, 4).map((c) => (
                                <Badge key={c.id} variant="neutral" size="sm">
                                  {c.title}
                                </Badge>
                              ))}
                              {assignedCourses.length > 4 && (
                                <Badge variant="neutral" size="sm">
                                  +{assignedCourses.length - 4} أخرى
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon="edit"
                            onClick={() => handleOpenScopeModal('job_title', job.id, job.nameAr)}
                            data-testid={`edit-job-courses-btn-${job.id}`}
                          >
                            تعديل كورسات الوظيفة
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs sm:text-sm" data-testid="visibility-by-leadership-table">
              <thead className="bg-bg-alt/60 border-b border-border text-xs text-text-muted font-bold">
                <tr>
                  <th className="py-3.5 px-4">الصفة القيادية / الإشرافية</th>
                  <th className="py-3.5 px-3">الكورسات المخصصة لهذه الصفة</th>
                  <th className="py-3.5 px-4 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {leadershipTitles
                  .filter((lt) => !searchQuery.trim() || lt.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((lt) => {
                    const assignedCourses = courses.filter((c) =>
                      (c.targetLeadershipTitles || []).includes(lt)
                    );
                    return (
                      <tr key={lt} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-text-heading">{lt}</td>
                        <td className="py-3.5 px-3">
                          {assignedCourses.length === 0 ? (
                            <span className="text-xs text-text-muted">
                              لا توجد كورسات مخصصة خصيصاً لهذه الصفة القيادية
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="warning" size="sm">
                                {assignedCourses.length} كورس مخصص
                              </Badge>
                              {assignedCourses.slice(0, 4).map((c) => (
                                <Badge key={c.id} variant="neutral" size="sm">
                                  {c.title}
                                </Badge>
                              ))}
                              {assignedCourses.length > 4 && (
                                <Badge variant="neutral" size="sm">
                                  +{assignedCourses.length - 4} أخرى
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon="edit"
                            onClick={() => handleOpenScopeModal('leadership', lt, lt)}
                            data-testid={`edit-leadership-courses-btn-${lt}`}
                          >
                            تعديل الكورسات
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Edit Departments, Job Titles & Leadership Titles for a Course */}
      <Modal
        isOpen={Boolean(editingCourse)}
        onClose={() => !isSaving && setEditingCourse(null)}
        title={`تحديد ظهور الكورس: ${editingCourse?.title || ''}`}
        size="2xl"
        dataTestId="edit-course-visibility-modal"
      >
        <div className="space-y-4" dir="rtl">
          {/* Clean Horizontal Tabs inside Modal */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            {[
              {
                id: 'departments' as const,
                label: 'الإدارات المستهدفة',
                count: modalDeptIds.length,
              },
              {
                id: 'job_titles' as const,
                label: 'المسميات الوظيفية',
                count: modalJobIds.length,
              },
              {
                id: 'leadership' as const,
                label: 'الصفات القيادية',
                count: modalLeadershipTitles.length,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setModalActiveTab(t.id);
                  setModalScopeSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  modalActiveTab === t.id
                    ? 'bg-primary-dark text-white shadow-xs'
                    : 'bg-bg text-text-muted hover:text-text hover:bg-bg-alt'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    modalActiveTab === t.id
                      ? 'bg-white/20 text-white'
                      : 'bg-surface border border-border text-text-heading'
                  }`}
                >
                  {t.count === 0 ? 'الكل' : t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search & Reset Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={modalScopeSearch}
                onChange={(e) => setModalScopeSearch(e.target.value)}
                placeholder={
                  modalActiveTab === 'departments'
                    ? 'بحث باسم الإدارة...'
                    : modalActiveTab === 'job_titles'
                      ? 'بحث بالمسمى الوظيفي أو الإدارة...'
                      : 'بحث بالصفة القيادية...'
                }
                className="w-full text-xs pr-9 pl-3 py-2 bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Icon
                name="search"
                size="sm"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
            </div>

            {((modalActiveTab === 'departments' && modalDeptIds.length > 0) ||
              (modalActiveTab === 'job_titles' && modalJobIds.length > 0) ||
              (modalActiveTab === 'leadership' && modalLeadershipTitles.length > 0)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (modalActiveTab === 'departments') setModalDeptIds([]);
                  else if (modalActiveTab === 'job_titles') setModalJobIds([]);
                  else setModalLeadershipTitles([]);
                }}
                className="text-xs shrink-0"
              >
                إتاحة للكل في هذا القسم
              </Button>
            )}
          </div>

          {/* Spacious 3-Column Selectable Cards (no nested scrollbar) */}
          <div>
            {modalActiveTab === 'departments' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {departments
                  .filter(
                    (d) =>
                      !modalScopeSearch.trim() ||
                      d.nameAr.toLowerCase().includes(modalScopeSearch.toLowerCase())
                  )
                  .map((dept) => {
                    const checked = modalDeptIds.includes(dept.id);
                    return (
                      <label
                        key={dept.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                          checked
                            ? 'border-primary bg-primary/5 text-text-heading font-semibold'
                            : 'border-border bg-bg/30 hover:bg-surface text-text'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setModalDeptIds((prev) => toggleId(prev, dept.id))}
                          className="h-4 w-4 rounded border-border accent-primary-dark shrink-0"
                        />
                        <span className="leading-snug">{dept.nameAr}</span>
                      </label>
                    );
                  })}
              </div>
            )}

            {modalActiveTab === 'job_titles' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {jobTitles
                  .filter(
                    (j) =>
                      !modalScopeSearch.trim() ||
                      j.nameAr.toLowerCase().includes(modalScopeSearch.toLowerCase()) ||
                      (j.departmentNameAr || '')
                        .toLowerCase()
                        .includes(modalScopeSearch.toLowerCase())
                  )
                  .map((job) => {
                    const checked = modalJobIds.includes(job.id);
                    return (
                      <label
                        key={job.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                          checked
                            ? 'border-primary bg-primary/5 text-text-heading font-semibold'
                            : 'border-border bg-bg/30 hover:bg-surface text-text'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setModalJobIds((prev) => toggleId(prev, job.id))}
                          className="h-4 w-4 rounded border-border accent-primary-dark shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="leading-snug">{job.nameAr}</div>
                          {job.departmentNameAr && (
                            <div className="text-[11px] text-text-muted mt-0.5">
                              {job.departmentNameAr}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}

            {modalActiveTab === 'leadership' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {leadershipTitles
                  .filter(
                    (lt) =>
                      !modalScopeSearch.trim() ||
                      lt.toLowerCase().includes(modalScopeSearch.toLowerCase())
                  )
                  .map((lt) => {
                    const checked = modalLeadershipTitles.includes(lt);
                    return (
                      <label
                        key={lt}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                          checked
                            ? 'border-primary bg-primary/5 text-text-heading font-semibold'
                            : 'border-border bg-bg/30 hover:bg-surface text-text'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setModalLeadershipTitles((prev) => toggleId(prev, lt))
                          }
                          className="h-4 w-4 rounded border-border accent-primary-dark shrink-0"
                        />
                        <span className="leading-snug">{lt}</span>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Selection Summary */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted bg-bg/50 px-3 py-2 rounded-xl border border-border">
            <span className="font-semibold text-text-heading">الملخص الحالي:</span>
            <span>الإدارات: {modalDeptIds.length === 0 ? 'الكل' : `${modalDeptIds.length} محددة`}</span>
            <span>·</span>
            <span>المسميات: {modalJobIds.length === 0 ? 'الكل' : `${modalJobIds.length} محددة`}</span>
            <span>·</span>
            <span>
              الصفات القيادية:{' '}
              {modalLeadershipTitles.length === 0 ? 'الكل' : `${modalLeadershipTitles.length} محددة`}
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingCourse(null)}
              disabled={isSaving}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="check"
              onClick={handleSaveCourseModal}
              isLoading={isSaving}
              data-testid="save-course-visibility-modal-btn"
            >
              حفظ قواعد الظهور
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Edit Courses for a Department or Job Title */}
      <Modal
        isOpen={Boolean(editingScope)}
        onClose={() => !isSaving && setEditingScope(null)}
        title={`تحديد الكورسات لـ: ${editingScope?.label || ''}`}
        size="md"
        dataTestId="edit-scope-courses-modal"
      >
        <div className="space-y-4" dir="rtl">
          <div className="relative">
            <input
              type="text"
              value={modalCourseSearch}
              onChange={(e) => setModalCourseSearch(e.target.value)}
              placeholder="بحث باسم الكورس..."
              className="w-full text-xs pr-9 pl-3 py-2 bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Icon
              name="search"
              size="sm"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border/60 border border-border rounded-xl">
            {courses
              .filter(
                (c) =>
                  !modalCourseSearch.trim() ||
                  c.title.toLowerCase().includes(modalCourseSearch.toLowerCase())
              )
              .map((course) => {
                const isSelected = modalCourseIds.includes(course.id);
                return (
                  <label
                    key={course.id}
                    className="flex items-center justify-between gap-3 p-3 hover:bg-bg/40 cursor-pointer text-xs"
                  >
                    <div>
                      <div className="font-bold text-text-heading">{course.title}</div>
                      <div className="text-[11px] text-text-muted">
                        {course.lifecycleStatus === 'Published' ? 'منشور' : 'مسودة'}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => setModalCourseIds((prev) => toggleId(prev, course.id))}
                      className="h-4 w-4 rounded border-border accent-primary-dark"
                    />
                  </label>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingScope(null)}
              disabled={isSaving}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon="check"
              onClick={handleSaveScopeModal}
              isLoading={isSaving}
              data-testid="save-scope-courses-modal-btn"
            >
              حفظ التخصيص ({modalCourseIds.length} كورس)
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DepartmentTracksPage;
