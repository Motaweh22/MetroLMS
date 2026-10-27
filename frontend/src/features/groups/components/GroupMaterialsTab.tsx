import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  GroupMaterialFolder,
  GroupMaterialFile,
  TrainingGroup,
} from '@/core/groups/types';
import { Card, CardContent } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon } from '@/shared/ui/Icon';
import { Alert } from '@/shared/ui/Alert';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useToast } from '@/shared/ui/Toast';
import { groupsApi } from '../services/groupsApi';
import {
  formatBytes,
  formatMaterialDate,
  getFileTypeMeta,
  isMaterialPreviewable,
  downloadMaterialFile,
} from '../utils/materialUtils';
import { GroupFolderModal } from './GroupFolderModal';
import { GroupUploadFilesModal } from './GroupUploadFilesModal';
import { GroupMoveFileModal } from './GroupMoveFileModal';
import { GroupMaterialViewerModal } from './GroupMaterialViewerModal';

export type SortField = 'name' | 'date' | 'type' | 'size';
export type SortDirection = 'asc' | 'desc';
export type MaterialViewMode = 'list' | 'grid';

interface GroupMaterialsTabProps {
  groupId: string;
  group: TrainingGroup;
  readOnly?: boolean; // When true (e.g. trainee view), hides all management actions
}

export const GroupMaterialsTab: React.FC<GroupMaterialsTabProps> = ({
  groupId,
  group,
  readOnly = false,
}) => {
  const toast = useToast();
  const [folders, setFolders] = useState<(GroupMaterialFolder & { files: GroupMaterialFile[] })[]>([]);
  const [rootFiles, setRootFiles] = useState<GroupMaterialFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected folder navigation state (null = Root level)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting state (default: name asc, folders before files)
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // View mode state: 'list' (detailed table) vs 'grid' (Windows Explorer icon cards)
  const [viewMode, setViewMode] = useState<MaterialViewMode>(() => {
    try {
      const saved = localStorage.getItem('metro_materials_view_mode');
      return saved === 'grid' ? 'grid' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleViewModeChange = (mode: MaterialViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('metro_materials_view_mode', mode);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  };

  // Focused browsing modal (Google Drive / Explorer full window mode)
  const [isFocusedExplorerOpen, setIsFocusedExplorerOpen] = useState(false);

  // Modals state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<GroupMaterialFolder | null>(null);
  const [isFolderSubmitting, setIsFolderSubmitting] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [fileToMove, setFileToMove] = useState<GroupMaterialFile | null>(null);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [previewFile, setPreviewFile] = useState<GroupMaterialFile | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Deletion confirm dialogs
  const [folderToDelete, setFolderToDelete] = useState<GroupMaterialFolder | null>(null);
  const [fileToDelete, setFileToDelete] = useState<GroupMaterialFile | null>(null);

  const fetchMaterials = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await groupsApi.getGroupMaterials(groupId);
      setFolders(data.folders || []);
      setRootFiles(data.rootFiles || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل حقيبة المواد';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Current active folder object
  const activeFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Breadcrumb path from root down to active folder
  const breadcrumbPath = useMemo(() => {
    if (!selectedFolderId || !activeFolder) return [];
    const path: GroupMaterialFolder[] = [];
    let current: (GroupMaterialFolder & { files: GroupMaterialFile[] }) | undefined = activeFolder;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      if (!current.parentId) break;
      current = folders.find((f) => f.id === current?.parentId);
    }
    return path;
  }, [selectedFolderId, activeFolder, folders]);

  // Folder CRUD handlers
  const handleCreateOrUpdateFolder = async (data: { name: string; isVisibleToTrainees: boolean }) => {
    setIsFolderSubmitting(true);
    try {
      if (folderToEdit) {
        await groupsApi.updateMaterialFolder(groupId, folderToEdit.id, data);
        toast.success(`تم تحديث بيانات المجلد: ${data.name}`);
      } else {
        await groupsApi.createMaterialFolder(groupId, {
          name: data.name,
          isVisibleToTrainees: data.isVisibleToTrainees,
          cycleId: group.currentCycleId,
          parentId: activeFolder ? activeFolder.id : null,
        });
        toast.success(`تم إنشاء المجلد بنجاح: ${data.name}`);
      }
      setIsFolderModalOpen(false);
      setFolderToEdit(null);
      await fetchMaterials();
    } finally {
      setIsFolderSubmitting(false);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await groupsApi.deleteMaterialFolder(groupId, folderToDelete.id);
      toast.success(`تم حذف المجلد: ${folderToDelete.name}`);
      if (selectedFolderId === folderToDelete.id) {
        setSelectedFolderId(folderToDelete.parentId || null);
      }
      setFolderToDelete(null);
      await fetchMaterials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حذف المجلد';
      toast.error(msg);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      await groupsApi.deleteMaterialFile(groupId, fileToDelete.id);
      toast.success(`تم حذف الملف بنجاح: ${fileToDelete.title}`);
      setFileToDelete(null);
      await fetchMaterials();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر حذف الملف';
      toast.error(msg);
    }
  };

  // Immediate subfolders for the current view
  const currentLevelFolders = useMemo(() => {
    return folders.filter((f) => {
      // Permission filter for trainees
      if (readOnly && f.isVisibleToTrainees === false) return false;

      // Parent ID matching
      if (selectedFolderId === null) {
        return !f.parentId;
      }
      return f.parentId === selectedFolderId;
    });
  }, [folders, selectedFolderId, readOnly]);

  // Immediate files for the current view
  const currentLevelFiles = useMemo(() => {
    const rawFiles = activeFolder ? (activeFolder.files || []) : rootFiles;
    return rawFiles.filter((file) => {
      if (readOnly && file.isVisible === false) return false;
      return true;
    });
  }, [activeFolder, rootFiles, readOnly]);

  // Search filtering
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return currentLevelFolders;
    const q = searchQuery.trim().toLowerCase();
    return currentLevelFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [currentLevelFolders, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return currentLevelFiles;
    const q = searchQuery.trim().toLowerCase();
    return currentLevelFiles.filter((file) => {
      return (
        file.title.toLowerCase().includes(q) ||
        file.originalFileName.toLowerCase().includes(q)
      );
    });
  }, [currentLevelFiles, searchQuery]);

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted Folders (folders appear before files by default)
  const sortedFolders = useMemo(() => {
    return [...filteredFolders].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' });
      } else if (sortField === 'date') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'type') {
        cmp = 'مجلد'.localeCompare('مجلد', 'ar');
      } else if (sortField === 'size') {
        cmp = (a.filesCount || 0) - (b.filesCount || 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredFolders, sortField, sortDirection]);

  // Sorted Files
  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.title.localeCompare(b.title, 'ar', { sensitivity: 'base' });
      } else if (sortField === 'date') {
        cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      } else if (sortField === 'type') {
        const typeA = a.fileType || '';
        const typeB = b.fileType || '';
        cmp = typeA.localeCompare(typeB, 'ar');
      } else if (sortField === 'size') {
        cmp = a.fileSizeBytes - b.fileSizeBytes;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredFiles, sortField, sortDirection]);

  // Handle navigate back to parent folder
  const handleNavigateBack = () => {
    if (!activeFolder) return;
    setSelectedFolderId(activeFolder.parentId || null);
    setSearchQuery('');
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="p-8 text-center space-y-4" data-testid="materials-loading" dir="rtl">
        <Icon name="clock" size="lg" className="animate-spin text-primary mx-auto" />
        <p className="text-sm font-medium text-text-muted">جارٍ تحميل حقيبة مواد المجموعة التدريبية...</p>
      </div>
    );
  }

  // Error State
  if (loadError) {
    return (
      <div className="p-4" dir="rtl">
        <Alert variant="danger" title="خطأ في تحميل المواد" data-testid="materials-error-alert">
          <div className="flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={fetchMaterials}>
              إعادة المحاولة
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Sort direction indicator icon/arrow
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <span className="opacity-30 text-[10px]">⇅</span>;
    }
    return (
      <span className="text-primary font-bold text-xs" data-testid={`sort-indicator-${field}`}>
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  // Explorer Core Component (rendered either inside card or in focused window)
  const renderExplorerContent = (isFocused = false) => {
    const isRoot = selectedFolderId === null;
    const isEmpty = sortedFolders.length === 0 && sortedFiles.length === 0;

    return (
      <div
        className={`flex flex-col flex-1 min-h-0 overflow-hidden ${
          isFocused
            ? 'w-full h-full bg-bg'
            : 'bg-surface rounded-2xl border border-border shadow-xs min-h-[550px]'
        }`}
        data-testid="explorer-browser-container"
      >
        {/* Explorer Address Bar & Navigation Toolbar */}
        <div
          className={`p-4 border-b border-border space-y-3 shrink-0 ${
            isFocused ? 'bg-surface/50' : 'bg-neutral-light/40'
          }`}
        >
          {/* Top Row: Address Bar & Management Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Address Bar / Breadcrumbs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-3 bg-bg rounded-xl border border-border text-xs text-text-muted flex-1 min-w-0 shadow-2xs">
              {/* Back Button */}
              {!isRoot && (
                <button
                  type="button"
                  onClick={handleNavigateBack}
                  className="p-1 rounded-lg hover:bg-neutral-light text-text hover:text-primary transition-colors shrink-0 ml-1 flex items-center gap-1 font-bold"
                  title="العودة للمجلد السابق"
                  data-testid="back-to-folders-btn"
                >
                  <Icon name="arrowRight" size="sm" />
                  <span className="hidden sm:inline">السابق</span>
                </button>
              )}

              {/* Root breadcrumb */}
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(null);
                  setSearchQuery('');
                }}
                className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                  isRoot ? 'text-primary font-bold' : ''
                }`}
                data-testid="breadcrumb-root"
              >
                <Icon name="folder" size="sm" />
                <span>حقيبة المواد</span>
              </button>

              {/* Nested folder segments */}
              {breadcrumbPath.map((folder, index) => {
                const isCurrent = index === breadcrumbPath.length - 1;
                return (
                  <React.Fragment key={folder.id}>
                    <span className="text-border shrink-0">/</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setSearchQuery('');
                      }}
                      className={`hover:text-primary transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                        isCurrent ? 'text-primary font-bold' : ''
                      }`}
                      data-testid={isCurrent ? 'breadcrumb-folder' : `breadcrumb-folder-${folder.id}`}
                    >
                      <Icon name="folderOpen" size="sm" className="text-primary shrink-0" />
                      <span className="truncate max-w-[180px]">{folder.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Top Row Actions: Management Buttons & Window Toggle */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFolderToEdit(null);
                      setIsFolderModalOpen(true);
                    }}
                    className="gap-1.5 font-bold text-xs shrink-0"
                    data-testid="open-create-folder-btn"
                    title="إنشاء مجلد داخل الموقع الحالي"
                  >
                    <Icon name="folderPlus" size="sm" />
                    <span>مجلد جديد</span>
                  </Button>

                  {activeFolder && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="gap-1.5 font-bold text-xs shrink-0"
                      data-testid="open-upload-files-btn"
                    >
                      <Icon name="upload" size="sm" />
                      <span>رفع ملفات</span>
                    </Button>
                  )}
                </>
              )}

              {/* Focus / Fullscreen Mode Toggle */}
              {!isFocused ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFocusedExplorerOpen(true)}
                  className="p-2 text-text-muted hover:text-text shrink-0"
                  title="عرض في نافذة مستكشف مستقلة واسعة (Google Drive / Explorer)"
                  data-testid="toggle-focused-explorer-btn"
                >
                  <Icon name="maximize" size="sm" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFocusedExplorerOpen(false)}
                  className="p-2 text-text-muted hover:text-text shrink-0"
                  title="تصغير / العودة للعرض المضمن"
                  data-testid="close-focused-explorer-btn"
                >
                  <Icon name="minimize" size="sm" />
                </Button>
              )}
            </div>
          </div>

          {/* Bottom Row: Search, View Mode Toggle & Sorting Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-border/50">
            {/* Search & View Mode Switcher */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search Field */}
              <div className="relative w-56 sm:w-64 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={activeFolder ? 'بحث في هذا المجلد...' : 'بحث في جميع المواد...'}
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-border bg-bg text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
                  data-testid="materials-search-input"
                />
                <Icon
                  name="search"
                  size="sm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5 rounded cursor-pointer"
                    title="مسح البحث"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div
                className="inline-flex items-center p-0.5 rounded-xl border border-border bg-bg shadow-2xs shrink-0"
                role="group"
                aria-label="نمط العرض"
                data-testid="view-mode-toggle"
              >
                <button
                  type="button"
                  onClick={() => handleViewModeChange('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-primary-light text-primary-dark shadow-2xs border border-primary/20'
                      : 'text-text-muted hover:text-text hover:bg-neutral-light border border-transparent'
                  }`}
                  aria-pressed={viewMode === 'list'}
                  aria-label="عرض القائمة"
                  title="عرض القائمة (جدول تفصيلي)"
                  data-testid="view-mode-list-btn"
                >
                  <Icon name="list" size="sm" />
                  <span>عرض القائمة</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleViewModeChange('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    viewMode === 'grid'
                      ? 'bg-primary-light text-primary-dark shadow-2xs border border-primary/20'
                      : 'text-text-muted hover:text-text hover:bg-neutral-light border border-transparent'
                  }`}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="عرض الأيقونات"
                  title="عرض الأيقونات (شبكة مستكشف الملفات)"
                  data-testid="view-mode-grid-btn"
                >
                  <Icon name="grid" size="sm" />
                  <span>عرض الأيقونات</span>
                </button>
              </div>
            </div>

            {/* Quick Info & Sorting Controls */}
            <div className="flex items-center justify-between lg:justify-end gap-3 text-xs text-text-muted flex-wrap">
              <div className="flex items-center gap-2">
                <span>
                  المحتويات: <strong className="text-text font-bold">{sortedFolders.length}</strong> مجلدات،{' '}
                  <strong className="text-text font-bold">{sortedFiles.length}</strong> ملفات
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-text-muted shrink-0">الترتيب:</span>
                <div className="inline-flex items-center gap-0.5 bg-bg border border-border/80 rounded-lg p-0.5 shadow-2xs">
                  {(
                    [
                      { field: 'name', label: 'الاسم' },
                      { field: 'date', label: 'التاريخ' },
                      { field: 'type', label: 'النوع' },
                      { field: 'size', label: 'الحجم' },
                    ] as const
                  ).map(({ field, label }) => {
                    const isActive = sortField === field;
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => handleSort(field)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                          isActive
                            ? 'bg-primary-light text-primary-dark font-bold border border-primary/20'
                            : 'text-text-muted hover:text-text border border-transparent'
                        }`}
                        data-testid={`grid-sort-${field}`}
                        title={`ترتيب حسب ${label} (${
                          isActive && sortDirection === 'asc' ? 'تنازلي عند النقر' : 'تصاعدي'
                        })`}
                      >
                        <span>{label}</span>
                        {isActive && (
                          <span className="text-[9px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Explorer Table / Content Area */}
        <div
          className="flex-1 overflow-y-auto min-h-0"
          data-testid={isRoot ? 'materials-folders-view' : 'materials-files-view'}
        >
          {isEmpty ? (
            <div className="text-center py-20 px-6 space-y-4 my-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Icon name="folder" size="xl" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-heading">
                  {searchQuery ? 'لا توجد عناصر تطابق البحث' : 'هذا المجلد فارغ حالياً'}
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                  {readOnly
                    ? 'لم يقم مشرف المجموعة بإضافة ملفات أو مجلدات متاحة للاطلاع حتى الآن.'
                    : 'يمكنك إنشاء مجلدات فرعية أو رفع مستندات تدريبية مباشرة في هذا المجلد.'}
                </p>
              </div>

              {!readOnly && !searchQuery && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFolderToEdit(null);
                      setIsFolderModalOpen(true);
                    }}
                    className="gap-1.5 font-bold text-xs"
                    data-testid="empty-create-folder-btn"
                  >
                    <Icon name="folderPlus" size="sm" />
                    <span>إنشاء مجلد</span>
                  </Button>
                  {activeFolder && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="gap-1.5 font-bold text-xs"
                      data-testid="empty-upload-files-btn"
                    >
                      <Icon name="upload" size="sm" />
                      <span>رفع أول ملف</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <div className="w-full overflow-x-auto flex-1 min-h-0">
              <table
                className="w-full text-right text-xs border-collapse min-w-[700px]"
                data-testid={isRoot ? 'folders-grid' : 'files-grid'}
              >
                {/* Table Column Headers with Clickable Sorting */}
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xs">
                  <tr className="border-b border-border text-text-muted select-none">
                    {/* Name column */}
                    <th
                      className="py-3.5 px-4 font-bold cursor-pointer hover:bg-neutral-light/50 transition-colors"
                      onClick={() => handleSort('name')}
                      data-testid="sort-header-name"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>الاسم</span>
                        {renderSortIndicator('name')}
                      </div>
                    </th>

                    {/* Date column */}
                    <th
                      className="py-3.5 px-4 font-bold cursor-pointer hover:bg-neutral-light/50 transition-colors w-44 whitespace-nowrap"
                      onClick={() => handleSort('date')}
                      data-testid="sort-header-date"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>تاريخ التعديل / الرفع</span>
                        {renderSortIndicator('date')}
                      </div>
                    </th>

                    {/* Type column */}
                    <th
                      className="py-3.5 px-4 font-bold cursor-pointer hover:bg-neutral-light/50 transition-colors w-36 whitespace-nowrap"
                      onClick={() => handleSort('type')}
                      data-testid="sort-header-type"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>النوع</span>
                        {renderSortIndicator('type')}
                      </div>
                    </th>

                    {/* Size column */}
                    <th
                      className="py-3.5 px-4 font-bold cursor-pointer hover:bg-neutral-light/50 transition-colors w-32 whitespace-nowrap"
                      onClick={() => handleSort('size')}
                      data-testid="sort-header-size"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>الحجم</span>
                        {renderSortIndicator('size')}
                      </div>
                    </th>

                    {/* Actions column */}
                    <th className="py-3.5 px-4 font-bold text-center w-40 whitespace-nowrap">الإجراءات</th>
                  </tr>
                </thead>

                {/* Table Rows (Folders first, then Files) */}
                <tbody className="divide-y divide-border/60">
                  {/* 1. Folders Rows */}
                  {sortedFolders.map((folder) => (
                    <tr
                      key={folder.id}
                      className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group cursor-pointer"
                      data-testid={`folder-card-${folder.id}`}
                    >
                      {/* Name & Icon */}
                      <td
                        className="py-3.5 px-4"
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center shrink-0 shadow-2xs border border-primary/20 group-hover:border-primary/40 transition-colors">
                            <Icon name="folder" size="md" className="text-primary-dark" />
                          </div>
                          <div className="min-w-0">
                            <span
                              className="font-bold text-text-heading group-hover:text-primary transition-colors block truncate"
                              data-testid={`open-folder-title-${folder.id}`}
                            >
                              {folder.name}
                            </span>
                            {!readOnly && !folder.isVisibleToTrainees && (
                              <span className="text-[10px] text-warning-dark font-medium">
                                (مخفي عن المتدربين)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {formatMaterialDate(folder.createdAt)}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold bg-neutral-light text-text-muted">
                          مجلد ملفات
                        </span>
                      </td>

                      {/* Size / Count */}
                      <td className="py-3.5 px-4 text-text-muted font-medium whitespace-nowrap">
                        {folder.filesCount > 0 ? `${folder.filesCount} ملفات` : 'فارغ'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolderId(folder.id);
                              setSearchQuery('');
                            }}
                            className="text-primary hover:bg-primary/10 p-1.5 h-auto text-xs font-bold gap-1"
                            data-testid={`open-folder-btn-${folder.id}`}
                            title="فتح المجلد"
                          >
                            <Icon name="folderOpen" size="sm" />
                            <span className="hidden xl:inline">فتح</span>
                          </Button>

                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToEdit(folder);
                                  setIsFolderModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-neutral-light transition-colors"
                                title="تعديل المجلد"
                                data-testid={`edit-folder-btn-${folder.id}`}
                              >
                                <Icon name="edit" size="sm" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(folder);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-neutral-light transition-colors"
                                title="حذف المجلد"
                                data-testid={`delete-folder-btn-${folder.id}`}
                              >
                                <Icon name="trash" size="sm" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* 2. Files Rows */}
                  {sortedFiles.map((file) => {
                    const meta = getFileTypeMeta(file.fileType);
                    const canPreview = isMaterialPreviewable(file.fileType);

                    return (
                      <tr
                        key={file.id}
                        className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                        data-testid={`file-card-${file.id}`}
                      >
                        {/* Name & Icon */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border ${meta.colorClass}`}
                            >
                              <Icon name={meta.iconName} size="md" />
                            </div>
                            <div className="min-w-0">
                              <span
                                onClick={() => {
                                  setPreviewFile(file);
                                  setIsViewerOpen(true);
                                }}
                                className="font-bold text-text-heading group-hover:text-primary transition-colors cursor-pointer block truncate"
                                data-testid={`file-title-${file.id}`}
                                title={file.title}
                              >
                                {file.title}
                              </span>
                              <span className="text-[10px] text-text-muted font-mono truncate block">
                                {file.originalFileName}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                          {formatMaterialDate(file.uploadedAt)}
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant={meta.variant} className="text-[10px] font-bold">
                            {meta.labelAr}
                          </Badge>
                        </td>

                        {/* Size */}
                        <td className="py-3.5 px-4 text-text font-mono font-medium whitespace-nowrap">
                          {formatBytes(file.fileSizeBytes)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {canPreview ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewFile(file);
                                  setIsViewerOpen(true);
                                }}
                                className="text-primary hover:bg-primary/10 p-1.5 h-auto text-xs font-bold gap-1"
                                data-testid={`preview-file-btn-${file.id}`}
                                title="معاينة المستند"
                              >
                                <Icon name="eye" size="sm" />
                                <span className="hidden xl:inline">معاينة</span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewFile(file);
                                  setIsViewerOpen(true);
                                }}
                                className="text-primary hover:bg-primary/10 p-1.5 h-auto text-xs font-bold gap-1"
                                data-testid={`preview-file-btn-${file.id}`}
                                title="معلومات وتحميل الملف"
                              >
                                <Icon name="download" size="sm" />
                                <span className="hidden xl:inline">تحميل</span>
                              </Button>
                            )}

                            {canPreview && (
                              <button
                                type="button"
                                onClick={() => downloadMaterialFile(file)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-neutral-light transition-colors"
                                title="تحميل الملف الأصلي"
                                data-testid={`download-file-btn-${file.id}`}
                              >
                                <Icon name="download" size="sm" />
                              </button>
                            )}

                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFileToMove(file);
                                    setIsMoveModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-neutral-light transition-colors"
                                  title="نقل إلى مجلد آخر"
                                  data-testid={`move-file-btn-${file.id}`}
                                >
                                  <Icon name="folder" size="sm" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setFileToDelete(file)}
                                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-neutral-light transition-colors"
                                  title="حذف الملف"
                                  data-testid={`delete-file-btn-${file.id}`}
                                >
                                  <Icon name="trash" size="sm" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Windows Explorer-Inspired Grid / Icon View */
            <div
              className="p-5 space-y-6 flex-1 overflow-y-auto min-h-0"
              data-testid={isRoot ? 'folders-grid' : 'files-grid'}
            >
              {/* Folders Section */}
              {sortedFolders.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-xs font-bold text-text-muted">
                    <Icon name="folder" size="sm" className="text-primary-dark" />
                    <span>المجلدات ({sortedFolders.length})</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-4 justify-start">
                    {sortedFolders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => {
                          setSelectedFolderId(folder.id);
                          setSearchQuery('');
                        }}
                        className="group relative flex flex-col items-center justify-between p-4 rounded-2xl border border-border/80 bg-surface hover:bg-surface-soft hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:shadow-sm text-center select-none min-h-[165px]"
                        data-testid={`folder-card-${folder.id}`}
                        title={`فتح المجلد: ${folder.name}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedFolderId(folder.id);
                            setSearchQuery('');
                          }
                        }}
                      >
                        {/* Top bar: Status & Actions */}
                        <div className="w-full flex items-center justify-between mb-1.5 min-h-[22px]">
                          <div>
                            {!readOnly && !folder.isVisibleToTrainees ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-warning-light text-warning-dark border border-warning/20 font-bold">
                                مخفي
                              </span>
                            ) : (
                              <span />
                            )}
                          </div>

                          {!readOnly && (
                            <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToEdit(folder);
                                  setIsFolderModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-neutral-light transition-colors"
                                title="تعديل المجلد"
                                data-testid={`edit-folder-btn-${folder.id}`}
                              >
                                <Icon name="edit" size="sm" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToDelete(folder);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-neutral-light transition-colors"
                                title="حذف المجلد"
                                data-testid={`delete-folder-btn-${folder.id}`}
                              >
                                <Icon name="trash" size="sm" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Folder Icon with Cairo Metro branding */}
                        <div className="w-16 h-16 rounded-2xl bg-primary-light text-primary-dark border border-primary/25 flex items-center justify-center my-1.5 group-hover:scale-105 transition-transform shadow-xs">
                          <Icon name="folder" size="xl" className="text-primary-dark" />
                        </div>

                        {/* Name and Metadata */}
                        <div className="w-full min-w-0 mt-1">
                          <span
                            className="font-bold text-xs text-text-heading group-hover:text-primary transition-colors block line-clamp-2 leading-tight w-full break-words px-1"
                            title={folder.name}
                            data-testid={`open-folder-title-${folder.id}`}
                          >
                            {folder.name}
                          </span>
                          <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted mt-1 font-medium">
                            <span>{folder.filesCount > 0 ? `${folder.filesCount} ملفات` : 'فارغ'}</span>
                            <span>•</span>
                            <span>{formatMaterialDate(folder.createdAt)}</span>
                          </div>
                        </div>

                        {/* Hidden button for programmatic / test compatibility */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFolderId(folder.id);
                            setSearchQuery('');
                          }}
                          className="sr-only"
                          data-testid={`open-folder-btn-${folder.id}`}
                          tabIndex={-1}
                        >
                          فتح المجلد
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {sortedFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-xs font-bold text-text-muted">
                    <Icon name="file" size="sm" className="text-text-muted" />
                    <span>الملفات ({sortedFiles.length})</span>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-4 justify-start">
                    {sortedFiles.map((file) => {
                      const meta = getFileTypeMeta(file.fileType);
                      const canPreview = isMaterialPreviewable(file.fileType);

                      return (
                        <div
                          key={file.id}
                          onClick={() => {
                            setPreviewFile(file);
                            setIsViewerOpen(true);
                          }}
                          className="group relative flex flex-col items-center justify-between p-4 rounded-2xl border border-border/80 bg-surface hover:bg-surface-soft hover:border-primary/40 transition-all cursor-pointer shadow-2xs hover:shadow-sm text-center select-none min-h-[165px]"
                          data-testid={`file-card-${file.id}`}
                          title={canPreview ? `معاينة: ${file.title}` : `تحميل / معلومات: ${file.title}`}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setPreviewFile(file);
                              setIsViewerOpen(true);
                            }
                          }}
                        >
                          {/* Top bar: Format badge & Actions */}
                          <div className="w-full flex items-center justify-between mb-1.5 min-h-[22px]">
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold font-mono uppercase bg-neutral-light text-text-muted border border-border/80">
                              {file.fileType}
                            </span>

                            <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                  setIsViewerOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-neutral-light transition-colors"
                                title={canPreview ? 'معاينة المستند' : 'معلومات الملف'}
                                data-testid={`preview-file-btn-${file.id}`}
                              >
                                <Icon name={canPreview ? 'eye' : 'download'} size="sm" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadMaterialFile(file);
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-neutral-light transition-colors"
                                title="تحميل الملف الأصلي"
                                data-testid={`download-file-btn-${file.id}`}
                              >
                                <Icon name="download" size="sm" />
                              </button>

                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFileToMove(file);
                                      setIsMoveModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-neutral-light transition-colors"
                                    title="نقل إلى مجلد آخر"
                                    data-testid={`move-file-btn-${file.id}`}
                                  >
                                    <Icon name="folder" size="sm" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFileToDelete(file);
                                    }}
                                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-neutral-light transition-colors"
                                    title="حذف الملف"
                                    data-testid={`delete-file-btn-${file.id}`}
                                  >
                                    <Icon name="trash" size="sm" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* File Type Icon */}
                          <div
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center my-1.5 group-hover:scale-105 transition-transform shadow-xs border ${meta.colorClass}`}
                          >
                            <Icon name={meta.iconName} size="xl" />
                          </div>

                          {/* File Name and Metadata */}
                          <div className="w-full min-w-0 mt-1">
                            <span
                              className="font-bold text-xs text-text-heading group-hover:text-primary transition-colors block line-clamp-2 leading-tight w-full cursor-pointer break-words px-1"
                              title={file.title}
                              data-testid={`file-title-${file.id}`}
                            >
                              {file.title}
                            </span>
                            <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-muted mt-1 font-medium">
                              <span className="font-mono">{formatBytes(file.fileSizeBytes)}</span>
                              <span>•</span>
                              <span>{formatMaterialDate(file.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="group-materials-tab" dir="rtl">
      {/* Primary Header Card */}
      <Card variant="elevated" className="border-border">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-1 font-semibold">
                <span className="text-primary font-bold flex items-center gap-1">
                  <Icon name="folder" size="sm" />
                  <span>مستكشف حقيبة المواد والمستندات التدريبية</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-text-heading">
                {activeFolder ? activeFolder.name : 'حقيبة المواد والمستندات الملحقة'}
              </h2>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5 leading-relaxed">
                {activeFolder
                  ? `مجلد يضم ${activeFolder.files?.length || 0} ملفاً ومجلداً فرعياً.`
                  : 'استعراض منظم للمجلدات والملفات بنمط مستكشف الملفات (Google Drive / Explorer).'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFocusedExplorerOpen(true)}
                className="gap-1.5 font-bold text-xs"
              >
                <Icon name="maximize" size="sm" />
                <span>فتح المستكشف الموسع</span>
              </Button>

              {!readOnly && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setFolderToEdit(null);
                      setIsFolderModalOpen(true);
                    }}
                    className="gap-1.5 font-bold text-xs"
                    data-testid="header-create-folder-btn"
                  >
                    <Icon name="folderPlus" size="sm" />
                    <span>مجلد جديد</span>
                  </Button>

                  {activeFolder && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsUploadModalOpen(true)}
                      className="gap-1.5 font-bold text-xs"
                      data-testid="folder-upload-files-btn"
                    >
                      <Icon name="upload" size="sm" />
                      <span>رفع ملفات</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Explorer View */}
      {renderExplorerContent(false)}

      {/* Focused / Fullscreen Explorer Window Modal */}
      <Modal
        isOpen={isFocusedExplorerOpen}
        onClose={() => setIsFocusedExplorerOpen(false)}
        title={`مستكشف ملفات المجموعة التدريبية: ${group.name}`}
        size="full"
        className="h-[90vh] max-h-[90vh] rounded-2xl shadow-2xl"
        bodyClassName="p-0 flex-1 flex flex-col min-h-0 overflow-hidden"
        data-testid="focused-explorer-modal"
      >
        <div dir="rtl" className="flex-1 flex flex-col min-h-0 h-full w-full">
          {renderExplorerContent(true)}
        </div>
      </Modal>

      {/* ── Dialogs & Modals ───────────────────────────────────────────────── */}

      {/* 1. Folder Create / Edit Modal */}
      <GroupFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setFolderToEdit(null);
        }}
        onSubmit={handleCreateOrUpdateFolder}
        folderToEdit={folderToEdit}
        isSubmitting={isFolderSubmitting}
      />

      {/* 2. File Upload Modal */}
      <GroupUploadFilesModal
        groupId={groupId}
        folder={activeFolder}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => fetchMaterials()}
      />

      {/* 3. Move File Modal */}
      <GroupMoveFileModal
        groupId={groupId}
        file={fileToMove}
        folders={folders}
        isOpen={isMoveModalOpen}
        onClose={() => {
          setIsMoveModalOpen(false);
          setFileToMove(null);
        }}
        onMoveSuccess={() => {
          toast.success('تم نقل الملف بنجاح إلى المجلد الجديد');
          fetchMaterials();
        }}
      />

      {/* 4. Preview / Viewer Modal */}
      <GroupMaterialViewerModal
        file={previewFile}
        isOpen={isViewerOpen}
        onClose={() => {
          setIsViewerOpen(false);
          setPreviewFile(null);
        }}
      />

      {/* 5. Delete Folder Confirmation */}
      <ConfirmDialog
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleConfirmDeleteFolder}
        title="تأكيد حذف مجلد المواد"
        message={
          folderToDelete && folderToDelete.filesCount > 0
            ? `المجلد "${folderToDelete.name}" يحتوي على ${folderToDelete.filesCount} ملفات تدريبية. هل ترغب بالتأكيد في حذفه نهائياً وحذف جميع الملفات بداخله؟`
            : `هل ترغب بالتأكيد في حذف المجلد "${folderToDelete?.name}"؟`
        }
        confirmLabel="حذف المجلد نهائياً"
        cancelLabel="إلغاء"
        variant="danger"
        data-testid="delete-folder-confirm-dialog"
      />

      {/* 6. Delete File Confirmation */}
      <ConfirmDialog
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDeleteFile}
        title="تأكيد حذف الملف"
        message={`هل ترغب بالتأكيد في حذف الملف "${fileToDelete?.title}" (${fileToDelete?.originalFileName}) نهائياً من حقيبة المواد؟`}
        confirmLabel="حذف الملف"
        cancelLabel="إلغاء"
        variant="danger"
        data-testid="delete-file-confirm-dialog"
      />
    </div>
  );
};
