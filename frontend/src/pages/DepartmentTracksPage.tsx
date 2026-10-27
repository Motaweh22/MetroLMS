import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { useToast } from '@/shared/ui/Toast';
import {
  departmentTracksApi,
  type DepartmentTracksCatalogResponse,
} from '@/features/permissions/services/departmentTracksApi';
import type {
  CanonicalDepartmentDTO,
  CanonicalTrackDTO,
  DepartmentPermissionDTO,
} from '@/core/permissions/types';

export const DepartmentTracksPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalogs
  const [departments, setDepartments] = useState<DepartmentPermissionDTO[]>([]);
  const [canonicalDepartments, setCanonicalDepartments] = useState<CanonicalDepartmentDTO[]>([]);
  const [tracks, setTracks] = useState<CanonicalTrackDTO[]>([]);

  // Selection & Editing
  const [selectedDeptId, setSelectedDeptId] = useState<string>('DEPT-OPERATIONS');
  const [editingAllowedTracks, setEditingAllowedTracks] = useState<string[]>([]);
  const [searchDeptQuery, setSearchDeptQuery] = useState('');
  const [justification, setJustification] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isAssistantAdmin = user?.role === 'assistant_admin';
  const isAdmin = user?.role === 'admin';
  const isAuthorized = isAdmin || isAssistantAdmin;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data: DepartmentTracksCatalogResponse = await departmentTracksApi.getDepartmentTracksConfig();
      setDepartments(data.departments);
      setCanonicalDepartments(data.canonicalDepartments);
      setTracks(data.tracks);

      // Set initial selected department tracks
      const initialDept = data.departments.find((d) => d.departmentId === selectedDeptId) || data.departments[0];
      if (initialDept) {
        setSelectedDeptId(initialDept.departmentId);
        setEditingAllowedTracks([...initialDept.allowedTracks]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل إعدادات مسارات الإدارات';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDeptId]);

  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

  // Current selected department config
  const selectedDeptConfig = useMemo(() => {
    return departments.find((d) => d.departmentId === selectedDeptId);
  }, [departments, selectedDeptId]);

  // Current canonical department details
  const selectedCanonicalDept = useMemo(() => {
    return canonicalDepartments.find((d) => d.id === selectedDeptId);
  }, [canonicalDepartments, selectedDeptId]);

  // Track changes vs saved state
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedDeptConfig) return false;
    const originalSet = new Set(selectedDeptConfig.allowedTracks);
    const editingSet = new Set(editingAllowedTracks);
    if (originalSet.size !== editingSet.size) return true;
    for (const t of originalSet) {
      if (!editingSet.has(t)) return true;
    }
    return false;
  }, [selectedDeptConfig, editingAllowedTracks]);

  // Select department
  const handleSelectDepartment = (deptId: string) => {
    if (deptId === selectedDeptId) return;
    const target = departments.find((d) => d.departmentId === deptId);
    setSelectedDeptId(deptId);
    setEditingAllowedTracks(target ? [...target.allowedTracks] : []);
    setJustification('');
  };

  // Toggle track selection
  const handleToggleTrack = (trackId: string) => {
    setEditingAllowedTracks((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      } else {
        return [...prev, trackId];
      }
    });
  };

  // Quick actions
  const handleSelectAllTracks = () => {
    setEditingAllowedTracks(tracks.map((t) => t.id));
  };

  const handleDeselectAllTracks = () => {
    setEditingAllowedTracks([]);
  };

  const handleResetToSaved = () => {
    if (selectedDeptConfig) {
      setEditingAllowedTracks([...selectedDeptConfig.allowedTracks]);
      setJustification('');
    }
  };

  // Save changes
  const handleSaveDepartmentTracks = async () => {
    if (!selectedDeptId) return;
    setIsSaving(true);
    try {
      const res = await departmentTracksApi.updateDepartmentTracks(
        selectedDeptId,
        editingAllowedTracks,
        justification.trim() || undefined
      );

      if (res.requiresApproval) {
        toast.info(res.messageAr || 'تم إرسال طلب الاعتماد بنجاح إلى مدير النظام');
      } else {
        toast.success(res.messageAr || 'تم تحديث مسارات الإدارة بنجاح');
      }

      // Update local state
      setDepartments((prev) =>
        prev.map((d) => (d.departmentId === res.department.departmentId ? res.department : d))
      );
      setEditingAllowedTracks([...res.department.allowedTracks]);
      setJustification('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل تحديث مسارات الإدارة';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered departments for list
  const filteredDepartments = useMemo(() => {
    if (!searchDeptQuery.trim()) return canonicalDepartments;
    const q = searchDeptQuery.trim().toLowerCase();
    return canonicalDepartments.filter(
      (d) =>
        d.nameAr.toLowerCase().includes(q) ||
        d.nameEn.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
    );
  }, [canonicalDepartments, searchDeptQuery]);

  if (!isAuthorized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl text-right" data-testid="unauthorized-department-tracks-view">
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
      className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl space-y-6 text-right"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/permissions')}
              className="text-text-muted hover:text-text px-2"
              aria-label="العودة لمصفوفة الصلاحيات والحوكمة"
            >
              <Icon name="arrowRight" size="sm" className="ml-1" />
              سياسة الصلاحيات
            </Button>
            <span className="text-border">/</span>
            <Badge variant="primary" size="sm" className="font-semibold">
              المسارات التدريبية المعتمدة
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary-dark flex items-center justify-center shrink-0">
              <Icon name="grid" size="lg" />
            </span>
            تخصيص مسارات التدريب للإدارات
          </h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-3xl leading-relaxed">
            تخصيص وحوكمة مسارات البرامج التدريبية المعتمدة لكل قطاع وإدارة تشغيلية بشركة مترو القاهرة لضمان استيفاء المعايير الفنية وتوثيق السياسات التشغيلية.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            data-testid="refresh-dept-tracks-btn"
          >
            <Icon name="rotateCcw" size="sm" className="ml-1.5" />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Architectural Policy & Catalog Decoupling Alert */}
      <Alert
        type="info"
        title="محددات الحوكمة المؤسسية وتوثيق المسارات"
        message="تخصيص مسارات التدريب في هذه الصفحة يحدد ويوثق المسارات الفنية المعتمدة لكل إدارة تشغيلية فقط. حجب الدورات تلقائياً في دليل الدورات محجوز لمراحل لاحقة بموجب وثيقة التصميم، ولا يؤثر هذا التخصيص على إتاحة الكتالوج العام للمتدربين."
      />

      {error && (
        <Alert
          variant="danger"
          title="خطأ في تحميل البيانات"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-1">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadData}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Department Directory Selector (4 cols) */}
        <div className="lg:col-span-4 bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border bg-bg-alt/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-text flex items-center gap-2">
                <Icon name="trainingGroups" size="sm" className="text-primary-dark" />
                قائمة القطاعات والإدارات
              </span>
              <Badge variant="neutral" size="sm">
                {canonicalDepartments.length} إدارات
              </Badge>
            </div>
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                data-testid="dept-search-input"
                value={searchDeptQuery}
                onChange={(e) => setSearchDeptQuery(e.target.value)}
                placeholder="بحث باسم الإدارة أو الرمز..."
                className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 pr-9 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
              />
              <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-text-muted">
                <Icon name="search" size="sm" />
              </span>
            </div>
          </div>

          {/* Department List */}
          <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto" data-testid="department-list">
            {isLoading ? (
              <div className="p-6 text-center text-text-muted text-xs">جاري تحميل الإدارات...</div>
            ) : filteredDepartments.length === 0 ? (
              <div className="p-6 text-center text-text-muted text-xs">لا توجد إدارات مطابقة للبحث</div>
            ) : (
              filteredDepartments.map((dept) => {
                const config = departments.find((d) => d.departmentId === dept.id);
                const trackCount = config?.allowedTracks.length || 0;
                const isSelected = dept.id === selectedDeptId;

                return (
                  <button
                    key={dept.id}
                    type="button"
                    data-testid={`dept-item-${dept.id}`}
                    onClick={() => handleSelectDepartment(dept.id)}
                    className={`w-full text-right p-3.5 transition-colors flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? 'bg-primary/10 border-r-4 border-r-primary-dark font-medium'
                        : 'hover:bg-bg-alt/60'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-semibold text-text truncate">
                        {dept.nameAr}
                      </div>
                      <div className="text-xs text-text-muted font-mono">{dept.id}</div>
                    </div>
                    <Badge
                      variant={isSelected ? 'primary' : 'neutral'}
                      size="sm"
                      className="shrink-0 text-xs font-mono"
                    >
                      {trackCount} / {tracks.length} مسار
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Track Configuration Panel (8 cols) */}
        <div className="lg:col-span-8 bg-surface rounded-xl border border-border shadow-xs overflow-hidden space-y-0">
          {/* Selected Department Header */}
          <div className="p-5 border-b border-border bg-bg-alt/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {selectedCanonicalDept?.id || selectedDeptId}
                </Badge>
                {hasUnsavedChanges && (
                  <Badge variant="warning" size="sm" data-testid="unsaved-changes-badge">
                    تعديلات غير محفوظة
                  </Badge>
                )}
                {isAssistantAdmin && (
                  <Badge variant="neutral" size="sm">
                    إجراء يتطلب اعتماد
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-bold text-text">
                {selectedCanonicalDept?.nameAr || selectedDeptConfig?.departmentName || selectedDeptId}
              </h2>
              {selectedCanonicalDept?.descriptionAr && (
                <p className="text-xs text-text-muted">{selectedCanonicalDept.descriptionAr}</p>
              )}
            </div>

            {/* Quick Multi-select Controls */}
            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllTracks}
                disabled={isSaving}
                className="text-xs"
              >
                تحديد الكل
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAllTracks}
                disabled={isSaving}
                className="text-xs"
              >
                إلغاء التحديد
              </Button>
              {hasUnsavedChanges && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetToSaved}
                  disabled={isSaving}
                  className="text-xs text-text-muted hover:text-text"
                >
                  استعادة
                </Button>
              )}
            </div>
          </div>

          {/* Tracks Matrix / Checkboxes */}
          <div className="p-5 space-y-3" data-testid="tracks-checklist">
            <div className="text-xs font-semibold text-text-muted flex items-center justify-between pb-1">
              <span>المسارات التدريبية المعتمدة للإدارة ({editingAllowedTracks.length} من {tracks.length} محدد):</span>
              <span className="text-[11px] text-text-muted">انقر على المسار لتفعيله أو إلغائه</span>
            </div>

            {tracks.map((track) => {
              const isChecked = editingAllowedTracks.includes(track.id);

              return (
                <div
                  key={track.id}
                  data-testid={`track-row-${track.id}`}
                  onClick={() => handleToggleTrack(track.id)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                    isChecked
                      ? 'border-primary/40 bg-primary/5 shadow-xs'
                      : 'border-border bg-surface hover:bg-bg-alt/50'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      id={`checkbox-${track.id}`}
                      data-testid={`track-checkbox-${track.id}`}
                      checked={isChecked}
                      onChange={() => {}} // Controlled via row click
                      className="w-4 h-4 rounded text-primary-dark focus:ring-primary cursor-pointer accent-primary-dark"
                    />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-text">{track.nameAr}</span>
                      <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
                        {track.id}
                      </Badge>
                      <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
                        {track.code}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed">{track.descriptionAr}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save / Approval Footer Panel */}
          <div className="p-5 border-t border-border bg-bg-alt/40 space-y-4">
            {isAssistantAdmin && (
              <div className="space-y-1.5">
                <label
                  htmlFor="justification-input"
                  className="block text-xs font-medium text-text"
                >
                  مبرر التعديل المقترح (يتم إرفاقه بطلب الاعتماد إلى مدير النظام):
                </label>
                <input
                  id="justification-input"
                  data-testid="justification-input"
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="مثال: إضافة مسار السلامة المهنية طبقاً لخطة التدريب السنوية المعتمدة..."
                  className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-right"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-text-muted">
                {selectedDeptConfig?.updatedAt ? (
                  <span>
                    آخر تحديث محفوظ: {new Date(selectedDeptConfig.updatedAt).toLocaleDateString('ar-EG')}
                    {selectedDeptConfig.updatedBy && ` (${selectedDeptConfig.updatedBy})`}
                  </span>
                ) : (
                  <span>لم يتم حفظ إعدادات سابقة لهذه الإدارة</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSaveDepartmentTracks}
                  isLoading={isSaving}
                  disabled={!hasUnsavedChanges || isSaving}
                  data-testid="save-dept-tracks-btn"
                  className="w-full sm:w-auto"
                >
                  <Icon name="save" size="sm" className="ml-1.5" />
                  {isAssistantAdmin ? 'إرسال طلب الاعتماد' : 'حفظ مسارات الإدارة'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentTracksPage;
