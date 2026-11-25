import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, ApiError } from '@/core/api/apiClient';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { StyledSelect } from '@/shared/ui/StyledSelect';
import { useToast } from '@/shared/ui/Toast';
import {
  CatalogResolveDeleteModal,
  type CatalogDependenciesResponse,
} from '@/features/organization/components/CatalogResolveDeleteModal';

type CatalogTabKey = 'departments' | 'job-titles' | 'leadership-titles' | 'metro-lines';

interface UsageSummary {
  usersCount: number;
  jobTitlesCount: number;
  coursesCount: number;
  totalBlockers: number;
}

interface CatalogRecord {
  id: number;
  nameAr: string;
  nameEn?: string | null;
  departmentId?: number | null;
  departmentNameAr?: string | null;
  usageSummary?: UsageSummary;
}

interface TabConfig {
  key: CatalogTabKey;
  label: string;
  singularLabel: string;
  responseKey: 'departments' | 'jobTitles' | 'leadershipTitles' | 'metroLines';
  endpoint: string;
  placeholderAr: string;
  placeholderEn: string;
}

const TABS: TabConfig[] = [
  {
    key: 'departments',
    label: 'القطاعات والإدارات',
    singularLabel: 'قطاع / إدارة',
    responseKey: 'departments',
    endpoint: '/api/admin/organization/departments',
    placeholderAr: 'مثال: قطاع التشغيل والصيانة',
    placeholderEn: 'e.g. Operations & Maintenance',
  },
  {
    key: 'job-titles',
    label: 'المسميات الوظيفية',
    singularLabel: 'مسمى وظيفي',
    responseKey: 'jobTitles',
    endpoint: '/api/admin/organization/job-titles',
    placeholderAr: 'مثال: مهندس إشارات أول',
    placeholderEn: 'e.g. Senior Signals Engineer',
  },
  {
    key: 'leadership-titles',
    label: 'الصفات القيادية / الإشرافية',
    singularLabel: 'صفة قيادية',
    responseKey: 'leadershipTitles',
    endpoint: '/api/admin/organization/leadership-titles',
    placeholderAr: 'مثال: مدير عام',
    placeholderEn: 'e.g. General Manager',
  },
  {
    key: 'metro-lines',
    label: 'خطوط المترو',
    singularLabel: 'خط مترو',
    responseKey: 'metroLines',
    endpoint: '/api/admin/organization/metro-lines',
    placeholderAr: 'مثال: الخط الثالث',
    placeholderEn: 'e.g. Line 3',
  },
];

export const OrganizationCatalogPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<CatalogTabKey>('departments');
  const [items, setItems] = useState<CatalogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  // Departments list for linking Job Titles
  const [departmentsList, setDepartmentsList] = useState<CatalogRecord[]>([]);

  // Inline edit & filters state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState<string>('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [checkingDepsId, setCheckingDepsId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [allJobTitles, setAllJobTitles] = useState<CatalogRecord[]>([]);

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEditingId(null);
    try {
      const [data, deptsData, jobsData] = await Promise.all([
        apiClient<Record<string, CatalogRecord[]>>(currentTab.endpoint),
        currentTab.key === 'job-titles' || currentTab.key === 'departments'
          ? currentTab.key === 'departments'
            ? Promise.resolve(null)
            : apiClient<{ departments?: CatalogRecord[] }>('/api/admin/organization/departments')
          : Promise.resolve(null),
        currentTab.key === 'departments'
          ? apiClient<{ jobTitles?: CatalogRecord[] }>('/api/admin/organization/job-titles')
          : Promise.resolve(null),
      ]);
      const nextItems = data[currentTab.responseKey] || [];
      setItems(nextItems);
      if (deptsData?.departments) {
        setDepartmentsList(deptsData.departments);
      } else if (currentTab.key === 'departments') {
        setDepartmentsList(nextItems);
      }
      if (jobsData?.jobTitles) {
        setAllJobTitles(jobsData.jobTitles);
      } else if (currentTab.key === 'job-titles') {
        setAllJobTitles(nextItems);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات الوظيفية.');
    } finally {
      setIsLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    setSearchQuery('');
    setDeptFilter('all');
    setUsageFilter('all');
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (q) {
        const matchesName =
          item.nameAr.toLowerCase().includes(q) ||
          (item.nameEn || '').toLowerCase().includes(q) ||
          (item.departmentNameAr || '').toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      if (currentTab.key === 'job-titles' && deptFilter !== 'all') {
        if (deptFilter === 'global') {
          if (item.departmentId != null) return false;
        } else if (String(item.departmentId ?? '') !== deptFilter) {
          return false;
        }
      }
      if (usageFilter !== 'all' && item.usageSummary) {
        if (usageFilter === 'used' && item.usageSummary.totalBlockers === 0) return false;
        if (usageFilter === 'unused' && item.usageSummary.totalBlockers > 0) return false;
      }
      return true;
    });
  }, [items, searchQuery, currentTab.key, deptFilter, usageFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    (currentTab.key === 'job-titles' && deptFilter !== 'all') ||
    usageFilter !== 'all';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAr = newNameAr.trim();
    if (!trimmedAr) {
      toast.warning(`يرجى إدخال الاسم العربي لـ ${currentTab.singularLabel}.`);
      return;
    }
    setIsAdding(true);
    try {
      await apiClient(currentTab.endpoint, {
        method: 'POST',
        body: JSON.stringify({
          nameAr: trimmedAr,
          nameEn: newNameEn.trim() || null,
          ...(currentTab.key === 'job-titles'
            ? { departmentId: newDepartmentId ? Number(newDepartmentId) : null }
            : {}),
        }),
      });
      setNewNameAr('');
      setNewNameEn('');
      toast.success(`تمت إضافة ${currentTab.singularLabel} "${trimmedAr}" بنجاح.`);
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'تعذر إضافة العنصر.');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (item: CatalogRecord) => {
    setEditingId(item.id);
    setEditNameAr(item.nameAr);
    setEditNameEn(item.nameEn || '');
    setEditDepartmentId(item.departmentId ? String(item.departmentId) : '');
  };

  const handleSaveEdit = async (id: number) => {
    const trimmedAr = editNameAr.trim();
    if (!trimmedAr) {
      toast.warning('الاسم العربي مطلوب.');
      return;
    }
    setSavingId(id);
    try {
      await apiClient(`${currentTab.endpoint}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nameAr: trimmedAr,
          nameEn: editNameEn.trim() || null,
          ...(currentTab.key === 'job-titles'
            ? { departmentId: editDepartmentId ? Number(editDepartmentId) : null }
            : {}),
        }),
      });
      setEditingId(null);
      toast.success('تم تحديث البيانات بنجاح.');
      await fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'تعذر تحديث العنصر.');
    } finally {
      setSavingId(null);
    }
  };

  const [pendingDeleteItem, setPendingDeleteItem] = useState<CatalogRecord | null>(null);
  const [resolveModalDeps, setResolveModalDeps] = useState<CatalogDependenciesResponse | null>(null);

  const openDependencyInspector = async (item: CatalogRecord): Promise<CatalogDependenciesResponse | null> => {
    try {
      const deps = await apiClient<CatalogDependenciesResponse>(
        `/api/admin/organization/${currentTab.key}/${item.id}/dependencies`
      );
      if (
        deps &&
        (deps.canDeleteDirectly === false ||
          (deps.users && deps.users.length > 0) ||
          (deps.jobTitles && deps.jobTitles.length > 0) ||
          (deps.courses && deps.courses.length > 0))
      ) {
        return deps;
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleDelete = async (item: CatalogRecord) => {
    setCheckingDepsId(item.id);
    try {
      const blockingDeps = await openDependencyInspector(item);
      if (blockingDeps) {
        setResolveModalDeps(blockingDeps);
      } else {
        setPendingDeleteItem(item);
      }
    } finally {
      setCheckingDepsId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteItem) return;
    const item = pendingDeleteItem;
    setDeletingId(item.id);
    try {
      await apiClient(`${currentTab.endpoint}/${item.id}`, {
        method: 'DELETE',
      });
      toast.success(`تم حذف "${item.nameAr}" بنجاح.`);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setPendingDeleteItem(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const blockingDeps = await openDependencyInspector(item);
        if (blockingDeps) {
          setPendingDeleteItem(null);
          setResolveModalDeps(blockingDeps);
          return;
        }
      }
      toast.error(
        err instanceof Error
          ? err.message
          : 'تعذر حذف العنصر. قد يكون مرتبطاً بمستخدمين أو بيانات حالية.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      role="main"
      data-testid="organization-catalog-page"
      className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl space-y-6"
    >
      {/* Breadcrumb */}
      <nav aria-label="مسار التنقل" className="flex items-center gap-2 text-xs text-text-muted">
        <Link
          to="/admin/users"
          className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
        >
          <Icon name="users" size="sm" />
          <span>إدارة دليل المستخدمين</span>
        </Link>
        <span className="text-text-muted/60">←</span>
        <span className="text-text font-bold">إدارة البيانات الوظيفية</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="settings" size="lg" />
              </span>
              إدارة البيانات الوظيفية
            </h1>
            <Badge variant="primary" size="sm">
              {isLoading ? '...' : `${items.length} عنصر`}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            إضافة وتعديل وحذف القطاعات والإدارات والمسميات الوظيفية والصفات القيادية وخطوط المترو المستخدمة في ملفات الموظفين
          </p>
        </div>

        <Link to="/admin/users">
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
            <Icon name="arrowRight" size="sm" className="ml-1.5" />
            العودة إلى دليل المستخدمين
          </Button>
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              data-testid={`org-tab-${tab.key}`}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface text-text-muted border border-border hover:text-text hover:bg-bg'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <Alert variant="danger" title="خطأ في تحميل البيانات">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={fetchItems}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Add New Item Form */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-bold text-text-heading">
          إضافة {currentTab.singularLabel} جديد
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className={`${currentTab.key === 'job-titles' ? 'sm:col-span-4' : 'sm:col-span-5'} flex flex-col gap-1.5`}>
            <label htmlFor="org-new-name-ar" className="text-xs font-semibold text-text">
              الاسم بالعربية <span className="text-danger">*</span>
            </label>
            <input
              id="org-new-name-ar"
              data-testid="org-new-name-ar-input"
              type="text"
              required
              disabled={isAdding}
              placeholder={currentTab.placeholderAr}
              value={newNameAr}
              onChange={(e) => setNewNameAr(e.target.value)}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-2 px-3 outline-none"
            />
          </div>

          <div className={`${currentTab.key === 'job-titles' ? 'sm:col-span-3' : 'sm:col-span-4'} flex flex-col gap-1.5`}>
            <label htmlFor="org-new-name-en" className="text-xs font-semibold text-text">
              الاسم بالإنجليزية <span className="text-text-muted text-[11px]">(اختياري)</span>
            </label>
            <input
              id="org-new-name-en"
              data-testid="org-new-name-en-input"
              type="text"
              dir="ltr"
              disabled={isAdding}
              placeholder={currentTab.placeholderEn}
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-2 px-3 outline-none text-left"
            />
          </div>

          {currentTab.key === 'job-titles' && (
            <div className="sm:col-span-3 flex flex-col gap-1.5">
              <label htmlFor="org-new-dept" className="text-xs font-semibold text-text">
                القطاع / الإدارة المرتبطة
              </label>
              <StyledSelect
                id="org-new-dept"
                dataTestId="org-new-dept-select"
                disabled={isAdding}
                value={newDepartmentId}
                onChange={(val) => setNewDepartmentId(val)}
                options={[
                  { value: '', label: 'عام (لكل الإدارات)' },
                  ...departmentsList.map((dept) => ({
                    value: String(dept.id),
                    label: dept.nameAr,
                  })),
                ]}
              />
            </div>
          )}

          <div className={`${currentTab.key === 'job-titles' ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAdding}
              disabled={isAdding}
              data-testid="org-add-submit-btn"
              className="w-full"
            >
              <Icon name="plus" size="sm" className="ml-1.5" />
              إضافة
            </Button>
          </div>
        </form>
      </Card>

      {/* Search & Filters */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className={`${currentTab.key === 'job-titles' ? 'sm:col-span-5' : 'sm:col-span-7'} flex flex-col gap-1`}>
            <label htmlFor="org-search-input" className="text-xs font-semibold text-text-muted">
              بحث في {currentTab.label}
            </label>
            <input
              id="org-search-input"
              data-testid="org-search-input"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم العربي أو الإنجليزي..."
              className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-1.5 px-3 outline-none"
            />
          </div>

          {currentTab.key === 'job-titles' && (
            <div className="sm:col-span-3 flex flex-col gap-1">
              <label htmlFor="org-filter-dept" className="text-xs font-semibold text-text-muted">
                تصفية حسب القطاع
              </label>
              <StyledSelect
                id="org-filter-dept"
                dataTestId="org-filter-dept-select"
                size="sm"
                value={deptFilter}
                onChange={(val) => setDeptFilter(val)}
                options={[
                  { value: 'all', label: 'كافة القطاعات (الكل)' },
                  { value: 'global', label: 'عام (لكل الإدارات)' },
                  ...departmentsList.map((dept) => ({
                    value: String(dept.id),
                    label: dept.nameAr,
                  })),
                ]}
              />
            </div>
          )}

          <div className={`${currentTab.key === 'job-titles' ? 'sm:col-span-2' : 'sm:col-span-3'} flex flex-col gap-1`}>
            <label htmlFor="org-filter-usage" className="text-xs font-semibold text-text-muted">
              حالة الارتباط
            </label>
            <StyledSelect
              id="org-filter-usage"
              dataTestId="org-filter-usage-select"
              size="sm"
              value={usageFilter}
              onChange={(val) => setUsageFilter(val as 'all' | 'used' | 'unused')}
              options={[
                { value: 'all', label: 'الكل' },
                { value: 'used', label: 'مرتبط بمستخدمين/دورات' },
                { value: 'unused', label: 'غير مرتبط (جاهز للحذف)' },
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!hasActiveFilters}
              data-testid="org-reset-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setDeptFilter('all');
                setUsageFilter('all');
              }}
              className="w-full justify-center text-xs text-text-muted border border-dashed border-border"
            >
              مسح الفلاتر
            </Button>
          </div>
        </div>
        {hasActiveFilters && (
          <p className="text-xs text-text-muted">
            عرض {filteredItems.length} من أصل {items.length} عنصر
          </p>
        )}
      </Card>

      {/* Catalog List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-text-muted">جاري تحميل القائمة...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            لا توجد عناصر مسجلة حالياً في {currentTab.label}.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            لا توجد عناصر مطابقة لمعايير البحث والتصفية الحالية.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  data-testid={`org-item-${item.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg/50 transition-colors"
                >
                  {isEditing ? (
                    <div className={`flex-1 grid grid-cols-1 ${currentTab.key === 'job-titles' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                      <input
                        type="text"
                        value={editNameAr}
                        onChange={(e) => setEditNameAr(e.target.value)}
                        disabled={savingId === item.id}
                        aria-label="الاسم بالعربية"
                        className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-1.5 px-3 outline-none"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                        disabled={savingId === item.id}
                        placeholder="English name (optional)"
                        aria-label="الاسم بالإنجليزية"
                        className="w-full bg-bg text-text text-sm rounded-lg border border-border focus:border-primary py-1.5 px-3 outline-none text-left"
                      />
                      {currentTab.key === 'job-titles' && (
                        <StyledSelect
                          value={editDepartmentId}
                          onChange={(val) => setEditDepartmentId(val)}
                          disabled={savingId === item.id}
                          ariaLabel="القطاع / الإدارة المرتبطة"
                          options={[
                            { value: '', label: 'عام (لكل الإدارات)' },
                            ...departmentsList.map((dept) => ({
                              value: String(dept.id),
                              label: dept.nameAr,
                            })),
                          ]}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-text-heading">{item.nameAr}</p>
                        {currentTab.key === 'job-titles' && (
                          <Badge variant={item.departmentNameAr ? 'primary' : 'neutral'} size="sm">
                            {item.departmentNameAr || 'عام (لكل الإدارات)'}
                          </Badge>
                        )}
                        {item.usageSummary && (
                          item.usageSummary.totalBlockers === 0 ? (
                            <Badge variant="success" size="sm">
                              غير مرتبط (قابل للحذف)
                            </Badge>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.usageSummary.usersCount > 0 && (
                                currentTab.key === 'departments' ? (
                                  <Link
                                    to={`/admin/users?department=${encodeURIComponent(item.nameAr)}`}
                                    title="عرض المستخدمين في الدليل"
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
                                  >
                                    {item.usageSummary.usersCount} مستخدم
                                  </Link>
                                ) : (
                                  <Badge variant="warning" size="sm">
                                    {item.usageSummary.usersCount} مستخدم
                                  </Badge>
                                )
                              )}
                              {item.usageSummary.jobTitlesCount > 0 && (
                                <Badge variant="neutral" size="sm">
                                  {item.usageSummary.jobTitlesCount} مسمى
                                </Badge>
                              )}
                              {item.usageSummary.coursesCount > 0 && (
                                <Badge variant="neutral" size="sm">
                                  {item.usageSummary.coursesCount} دورة
                                </Badge>
                              )}
                            </div>
                          )
                        )}
                      </div>
                      {item.nameEn && (
                        <p className="text-xs text-text-muted" dir="ltr">
                          {item.nameEn}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={savingId === item.id}
                          disabled={savingId === item.id}
                          onClick={() => handleSaveEdit(item.id)}
                        >
                          <Icon name="save" size="sm" className="ml-1" />
                          حفظ
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={savingId === item.id}
                          onClick={() => setEditingId(null)}
                        >
                          إلغاء
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(item)}
                          disabled={deletingId === item.id || checkingDepsId === item.id}
                        >
                          <Icon name="edit" size="sm" className="ml-1" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={deletingId === item.id || checkingDepsId === item.id}
                          disabled={deletingId === item.id || checkingDepsId === item.id}
                          onClick={() => handleDelete(item)}
                          data-testid={`org-delete-btn-${item.id}`}
                          className="text-danger border-danger/30 hover:bg-danger/10"
                        >
                          <Icon name="trash" size="sm" className="ml-1" />
                          حذف
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteItem)}
        title={`تأكيد حذف ${currentTab.singularLabel}`}
        message={
          pendingDeleteItem
            ? `هل أنت متأكد من حذف "${pendingDeleteItem.nameAr}"؟ لا يمكن التراجع عن هذه العملية.`
            : ''
        }
        confirmLabel="تأكيد الحذف"
        cancelLabel="إلغاء"
        variant="danger"
        isConfirming={Boolean(pendingDeleteItem && deletingId === pendingDeleteItem.id)}
        onCancel={() => {
          if (deletingId === null) setPendingDeleteItem(null);
        }}
        onConfirm={confirmDelete}
      />

      <CatalogResolveDeleteModal
        isOpen={Boolean(resolveModalDeps)}
        catalog={currentTab.key}
        singularLabel={currentTab.singularLabel}
        dependencies={resolveModalDeps}
        alternativeItems={items}
        allJobTitles={allJobTitles}
        allDepartments={departmentsList}
        onClose={() => setResolveModalDeps(null)}
        onResolved={async () => {
          await fetchItems();
        }}
      />
    </div>
  );
};

export default OrganizationCatalogPage;
