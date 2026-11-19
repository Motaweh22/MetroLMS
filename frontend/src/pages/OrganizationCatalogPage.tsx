import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/core/api/apiClient';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { Icon } from '@/shared/ui/Icon';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';

type CatalogTabKey = 'departments' | 'job-titles' | 'metro-lines';

interface CatalogRecord {
  id: number;
  nameAr: string;
  nameEn?: string | null;
}

interface TabConfig {
  key: CatalogTabKey;
  label: string;
  singularLabel: string;
  responseKey: 'departments' | 'jobTitles' | 'metroLines';
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
  const [isAdding, setIsAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameAr, setEditNameAr] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const currentTab = TABS.find((t) => t.key === activeTab) || TABS[0];

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setEditingId(null);
    try {
      const data = await apiClient<Record<string, CatalogRecord[]>>(currentTab.endpoint);
      setItems(data[currentTab.responseKey] || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات الوظيفية.');
    } finally {
      setIsLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

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

  const handleDelete = async (item: CatalogRecord) => {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف "${item.nameAr}"؟ لا يمكن التراجع عن هذه العملية.`
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    try {
      await apiClient(`${currentTab.endpoint}/${item.id}`, {
        method: 'DELETE',
      });
      toast.success(`تم حذف "${item.nameAr}" بنجاح.`);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (err: unknown) {
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
            إضافة وتعديل وحذف القطاعات والإدارات والمسميات الوظيفية وخطوط المترو المستخدمة في ملفات الموظفين
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
          <div className="sm:col-span-5 flex flex-col gap-1.5">
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

          <div className="sm:col-span-4 flex flex-col gap-1.5">
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

          <div className="sm:col-span-3">
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

      {/* Catalog List */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-text-muted">جاري تحميل القائمة...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            لا توجد عناصر مسجلة حالياً في {currentTab.label}.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div
                  key={item.id}
                  data-testid={`org-item-${item.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg/50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-text-heading">{item.nameAr}</p>
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
                          disabled={deletingId === item.id}
                        >
                          <Icon name="edit" size="sm" className="ml-1" />
                          تعديل
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={deletingId === item.id}
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
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
    </div>
  );
};

export default OrganizationCatalogPage;
