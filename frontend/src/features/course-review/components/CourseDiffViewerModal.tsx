import React, { useState, useMemo } from 'react';
import type {
  CourseBaselineSnapshot,
  CourseChapter,
  ChapterItem,
  CourseZipPolicy,
  ExternalResource,
} from '@/core/courses/types';
import { Modal } from '@/shared/ui/Modal';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

export interface CourseDiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  baselineSnapshot?: CourseBaselineSnapshot | null;
  adminEditedSnapshot?: CourseBaselineSnapshot | null;
  testId?: string;
}

export interface MetadataFieldDiff {
  key: string;
  label: string;
  baselineValue: string;
  adminEditedValue: string;
}

export interface ChapterDiffItem {
  id: string;
  diffType: 'added' | 'removed' | 'modified';
  title: string;
  baselineTitle?: string;
  adminTitle?: string;
  baselineOrder?: number;
  adminOrder?: number;
  isOrderChanged?: boolean;
}

export interface ResourceDiffItem {
  id: string;
  diffType: 'added' | 'removed' | 'modified';
  title: string;
  baselineTitle?: string;
  adminTitle?: string;
  baselineUrl?: string;
  adminUrl?: string;
  baselineDescription?: string;
  adminDescription?: string;
}

export interface LessonDiffItem {
  id: string;
  chapterId: string;
  diffType: 'added' | 'removed' | 'modified';
  title: string;
  baselineTitle?: string;
  adminTitle?: string;
  baselineType?: string;
  adminType?: string;
  baselineDuration?: string;
  adminDuration?: string;
  baselineDownloadPolicy?: string;
  adminDownloadPolicy?: string;
  baselineOrder?: number;
  adminOrder?: number;
  isOrderChanged?: boolean;
  resourceDiffs?: ResourceDiffItem[];
}

function computeResourceDiffs(
  baselineResources?: ExternalResource[] | null,
  adminResources?: ExternalResource[] | null
): ResourceDiffItem[] {
  const bList = baselineResources || [];
  const aList = adminResources || [];
  const diffs: ResourceDiffItem[] = [];

  const getResourceKey = (res: ExternalResource, idx: number): string => {
    if (res.id && res.id.trim()) return `id:${res.id.trim()}`;
    if (res.url && res.url.trim()) return `url:${res.url.trim()}`;
    if (res.title && res.title.trim()) return `title:${res.title.trim()}`;
    return `idx:${idx}`;
  };

  const bMap = new Map<string, ExternalResource>();
  bList.forEach((r, idx) => bMap.set(getResourceKey(r, idx), r));

  const aMap = new Map<string, ExternalResource>();
  aList.forEach((r, idx) => aMap.set(getResourceKey(r, idx), r));

  // Added resources
  aList.forEach((aRes, idx) => {
    const key = getResourceKey(aRes, idx);
    if (!bMap.has(key)) {
      diffs.push({
        id: aRes.id || `res-add-${idx}`,
        diffType: 'added',
        title: aRes.title,
        adminTitle: aRes.title,
        adminUrl: aRes.url,
        adminDescription: aRes.description,
      });
    }
  });

  // Removed resources
  bList.forEach((bRes, idx) => {
    const key = getResourceKey(bRes, idx);
    if (!aMap.has(key)) {
      diffs.push({
        id: bRes.id || `res-rem-${idx}`,
        diffType: 'removed',
        title: bRes.title,
        baselineTitle: bRes.title,
        baselineUrl: bRes.url,
        baselineDescription: bRes.description,
      });
    }
  });

  // Modified resources
  bList.forEach((bRes, idx) => {
    const key = getResourceKey(bRes, idx);
    const aRes = aMap.get(key);
    if (aRes) {
      const titleChanged = bRes.title !== aRes.title;
      const urlChanged = bRes.url !== aRes.url;
      const descChanged = (bRes.description || '') !== (aRes.description || '');
      if (titleChanged || urlChanged || descChanged) {
        diffs.push({
          id: aRes.id || bRes.id || `res-mod-${idx}`,
          diffType: 'modified',
          title: aRes.title || bRes.title,
          baselineTitle: bRes.title,
          adminTitle: aRes.title,
          baselineUrl: bRes.url,
          adminUrl: aRes.url,
          baselineDescription: bRes.description,
          adminDescription: aRes.description,
        });
      }
    }
  });

  return diffs;
}

function formatSnapshotDate(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) {
    return 'غير متوفر';
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return 'غير متوفر';
    }
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'غير متوفر';
  }
}

/**
 * CourseDiffViewerModal — Phase 7: Dual-Snapshot Diff Viewer
 *
 * Compares the exact submitted lecturer baseline snapshot against the
 * immutable administrator-edited snapshot saved upon returning a course with edits.
 *
 * Guarantees:
 * - Identifies additions, removals, reorders, and modifications across metadata, chapters, and lessons.
 * - Preserves stable chapter and item identity.
 * - Arabic RTL layout without emojis.
 * - Handles missing media references and unavailable dates gracefully.
 */
export const CourseDiffViewerModal: React.FC<CourseDiffViewerModalProps> = ({
  isOpen,
  onClose,
  baselineSnapshot,
  adminEditedSnapshot,
  testId = 'course-diff-viewer-modal',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'metadata' | 'chapters' | 'lessons'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // 1. Compute Metadata Diffs
  const metadataDiffs = useMemo<MetadataFieldDiff[]>(() => {
    if (!baselineSnapshot || !adminEditedSnapshot) return [];
    const diffs: MetadataFieldDiff[] = [];

    // Title
    if (baselineSnapshot.title !== adminEditedSnapshot.title) {
      diffs.push({
        key: 'title',
        label: 'عنوان المقرر',
        baselineValue: baselineSnapshot.title || 'غير متوفر',
        adminEditedValue: adminEditedSnapshot.title || 'غير متوفر',
      });
    }

    // Description
    if (baselineSnapshot.description !== adminEditedSnapshot.description) {
      diffs.push({
        key: 'description',
        label: 'وصف المقرر',
        baselineValue: baselineSnapshot.description || 'غير متوفر',
        adminEditedValue: adminEditedSnapshot.description || 'غير متوفر',
      });
    }

    // Level
    if (baselineSnapshot.level !== adminEditedSnapshot.level) {
      diffs.push({
        key: 'level',
        label: 'المستوى التدريبي',
        baselineValue: baselineSnapshot.level || 'غير متوفر',
        adminEditedValue: adminEditedSnapshot.level || 'غير متوفر',
      });
    }

    // Estimated Hours
    if (baselineSnapshot.estimatedHours !== adminEditedSnapshot.estimatedHours) {
      diffs.push({
        key: 'estimatedHours',
        label: 'الساعات التقديرية',
        baselineValue: baselineSnapshot.estimatedHours !== undefined ? `${baselineSnapshot.estimatedHours} ساعة` : 'غير متوفر',
        adminEditedValue: adminEditedSnapshot.estimatedHours !== undefined ? `${adminEditedSnapshot.estimatedHours} ساعة` : 'غير متوفر',
      });
    }

    // Cover Color / Type
    if (
      baselineSnapshot.coverColor !== adminEditedSnapshot.coverColor ||
      baselineSnapshot.coverType !== adminEditedSnapshot.coverType
    ) {
      diffs.push({
        key: 'cover',
        label: 'غلاف المقرر واللون المميز',
        baselineValue: `${baselineSnapshot.coverType || 'افتراضي'} (${baselineSnapshot.coverColor || 'غير محدد'})`,
        adminEditedValue: `${adminEditedSnapshot.coverType || 'افتراضي'} (${adminEditedSnapshot.coverColor || 'غير محدد'})`,
      });
    }

    // Course Zip Policy
    if (baselineSnapshot.courseZipPolicy !== adminEditedSnapshot.courseZipPolicy) {
      const formatZipPolicy = (policy?: CourseZipPolicy) => {
        if (!policy || policy === 'disabled') return 'معطلة';
        if (policy === 'immediate') return 'فورية عند التسجيل';
        return 'بعد إتمام المقرر';
      };
      diffs.push({
        key: 'courseZipPolicy',
        label: 'سياسة حزمة التنزيل (ZIP)',
        baselineValue: formatZipPolicy(baselineSnapshot.courseZipPolicy),
        adminEditedValue: formatZipPolicy(adminEditedSnapshot.courseZipPolicy),
      });
    }

    // Prerequisite Course
    if (baselineSnapshot.prerequisiteCourseId !== adminEditedSnapshot.prerequisiteCourseId) {
      diffs.push({
        key: 'prerequisiteCourseId',
        label: 'المتطلب السابق',
        baselineValue: baselineSnapshot.prerequisiteCourseId || 'لا يوجد متطلب سابق',
        adminEditedValue: adminEditedSnapshot.prerequisiteCourseId || 'لا يوجد متطلب سابق',
      });
    }

    // Target Job Titles
    const bJobs = (baselineSnapshot.targetJobTitles || []).slice().sort().join(', ');
    const aJobs = (adminEditedSnapshot.targetJobTitles || []).slice().sort().join(', ');
    if (bJobs !== aJobs) {
      diffs.push({
        key: 'targetJobTitles',
        label: 'الوظائف المستهدفة',
        baselineValue: bJobs || 'غير محددة',
        adminEditedValue: aJobs || 'غير محددة',
      });
    }

    // Course-Level External Resources Diff
    const courseResDiffs = computeResourceDiffs(
      baselineSnapshot.externalResources,
      adminEditedSnapshot.externalResources
    );
    if (courseResDiffs.length > 0) {
      const formatResSummary = (list?: ExternalResource[]) => {
        if (!list || list.length === 0) return 'لا توجد مصادر مرفقة';
        return `${list.length} مصادر (${list.map((r) => r.title).join('، ')})`;
      };
      diffs.push({
        key: 'externalResources',
        label: 'المصادر الخارجية للمقرر',
        baselineValue: formatResSummary(baselineSnapshot.externalResources),
        adminEditedValue: formatResSummary(adminEditedSnapshot.externalResources),
      });
    }

    return diffs;
  }, [baselineSnapshot, adminEditedSnapshot]);

  // Compute detailed course-level resource diffs
  const courseResourceDiffs = useMemo<ResourceDiffItem[]>(() => {
    if (!baselineSnapshot || !adminEditedSnapshot) return [];
    return computeResourceDiffs(
      baselineSnapshot.externalResources,
      adminEditedSnapshot.externalResources
    );
  }, [baselineSnapshot, adminEditedSnapshot]);

  // 2. Compute Chapter Diffs (matched stably by chapter id)
  const chapterDiffs = useMemo<ChapterDiffItem[]>(() => {
    if (!baselineSnapshot || !adminEditedSnapshot) return [];
    const bChapters = baselineSnapshot.chapters || [];
    const aChapters = adminEditedSnapshot.chapters || [];

    const bMap = new Map<string, CourseChapter>(bChapters.map((c) => [c.id, c]));
    const aMap = new Map<string, CourseChapter>(aChapters.map((c) => [c.id, c]));

    const diffs: ChapterDiffItem[] = [];

    // Find added chapters
    aChapters.forEach((aCh) => {
      if (!bMap.has(aCh.id)) {
        diffs.push({
          id: aCh.id,
          diffType: 'added',
          title: aCh.title,
          adminTitle: aCh.title,
          adminOrder: aCh.order,
        });
      }
    });

    // Find removed chapters
    bChapters.forEach((bCh) => {
      if (!aMap.has(bCh.id)) {
        diffs.push({
          id: bCh.id,
          diffType: 'removed',
          title: bCh.title,
          baselineTitle: bCh.title,
          baselineOrder: bCh.order,
        });
      }
    });

    // Find modified or reordered chapters
    bChapters.forEach((bCh) => {
      const aCh = aMap.get(bCh.id);
      if (aCh) {
        const titleChanged = bCh.title !== aCh.title;
        const orderChanged = bCh.order !== aCh.order;
        if (titleChanged || orderChanged) {
          diffs.push({
            id: bCh.id,
            diffType: 'modified',
            title: aCh.title,
            baselineTitle: bCh.title,
            adminTitle: aCh.title,
            baselineOrder: bCh.order,
            adminOrder: aCh.order,
            isOrderChanged: orderChanged,
          });
        }
      }
    });

    return diffs;
  }, [baselineSnapshot, adminEditedSnapshot]);

  // 3. Compute Lesson Item Diffs (matched stably by item id)
  const lessonDiffs = useMemo<LessonDiffItem[]>(() => {
    if (!baselineSnapshot || !adminEditedSnapshot) return [];
    interface ItemEntry {
      item: ChapterItem;
      chapterId: string;
      order: number;
    }
    const bItems: ItemEntry[] = [];
    (baselineSnapshot.chapters || []).forEach((ch) => {
      (ch.items || []).forEach((it, idx) => bItems.push({ item: it, chapterId: ch.id, order: idx + 1 }));
    });

    const aItems: ItemEntry[] = [];
    (adminEditedSnapshot.chapters || []).forEach((ch) => {
      (ch.items || []).forEach((it, idx) => aItems.push({ item: it, chapterId: ch.id, order: idx + 1 }));
    });

    const bMap = new Map<string, ItemEntry>(
      bItems.map((entry) => [entry.item.id, entry])
    );
    const aMap = new Map<string, ItemEntry>(
      aItems.map((entry) => [entry.item.id, entry])
    );

    const diffs: LessonDiffItem[] = [];

    // Added items
    aItems.forEach(({ item: aIt, chapterId, order }) => {
      if (!bMap.has(aIt.id)) {
        diffs.push({
          id: aIt.id,
          chapterId,
          diffType: 'added',
          title: aIt.title,
          adminTitle: aIt.title,
          adminType: aIt.type,
          adminDuration: aIt.duration,
          adminDownloadPolicy: aIt.downloadPolicy,
          adminOrder: order,
        });
      }
    });

    // Removed items
    bItems.forEach(({ item: bIt, chapterId, order }) => {
      if (!aMap.has(bIt.id)) {
        diffs.push({
          id: bIt.id,
          chapterId,
          diffType: 'removed',
          title: bIt.title,
          baselineTitle: bIt.title,
          baselineType: bIt.type,
          baselineDuration: bIt.duration,
          baselineDownloadPolicy: bIt.downloadPolicy,
          baselineOrder: order,
        });
      }
    });

    // Modified items
    bItems.forEach(({ item: bIt, chapterId: bChId, order: bOrder }) => {
      const aEntry = aMap.get(bIt.id);
      if (aEntry) {
        const aIt = aEntry.item;
        const aChId = aEntry.chapterId;
        const aOrder = aEntry.order;

        const titleChanged = bIt.title !== aIt.title;
        const typeChanged = bIt.type !== aIt.type;
        const durationChanged = bIt.duration !== aIt.duration;
        const downloadPolicyChanged = bIt.downloadPolicy !== aIt.downloadPolicy;
        const orderChanged = bOrder !== aOrder;
        const chapterChanged = bChId !== aChId;
        const mediaChanged = bIt.mediaId !== aIt.mediaId;
        const itemResDiffs = computeResourceDiffs(bIt.externalResources, aIt.externalResources);
        const resourcesChanged = itemResDiffs.length > 0;

        if (
          titleChanged ||
          typeChanged ||
          durationChanged ||
          downloadPolicyChanged ||
          orderChanged ||
          chapterChanged ||
          mediaChanged ||
          resourcesChanged
        ) {
          diffs.push({
            id: bIt.id,
            chapterId: aChId,
            diffType: 'modified',
            title: aIt.title,
            baselineTitle: bIt.title,
            adminTitle: aIt.title,
            baselineType: bIt.type,
            adminType: aIt.type,
            baselineDuration: bIt.duration,
            adminDuration: aIt.duration,
            baselineDownloadPolicy: bIt.downloadPolicy,
            adminDownloadPolicy: aIt.downloadPolicy,
            baselineOrder: bOrder,
            adminOrder: aOrder,
            isOrderChanged: orderChanged,
            resourceDiffs: itemResDiffs,
          });
        }
      }
    });

    return diffs;
  }, [baselineSnapshot, adminEditedSnapshot]);

  const totalChangesCount = metadataDiffs.length + chapterDiffs.length + lessonDiffs.length;

  // Filtered entries by keyword if user types search
  const filteredMetadata = useMemo(() => {
    if (!searchFilter.trim()) return metadataDiffs;
    const q = searchFilter.toLowerCase().trim();
    return metadataDiffs.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.baselineValue.toLowerCase().includes(q) ||
        m.adminEditedValue.toLowerCase().includes(q)
    );
  }, [metadataDiffs, searchFilter]);

  const filteredChapters = useMemo(() => {
    if (!searchFilter.trim()) return chapterDiffs;
    const q = searchFilter.toLowerCase().trim();
    return chapterDiffs.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.baselineTitle && c.baselineTitle.toLowerCase().includes(q))
    );
  }, [chapterDiffs, searchFilter]);

  const filteredLessons = useMemo(() => {
    if (!searchFilter.trim()) return lessonDiffs;
    const q = searchFilter.toLowerCase().trim();
    return lessonDiffs.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.baselineTitle && l.baselineTitle.toLowerCase().includes(q)) ||
        (l.resourceDiffs &&
          l.resourceDiffs.some(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              (r.adminUrl && r.adminUrl.toLowerCase().includes(q)) ||
              (r.baselineUrl && r.baselineUrl.toLowerCase().includes(q))
          ))
    );
  }, [lessonDiffs, searchFilter]);

  const hasMissingSnapshots = !baselineSnapshot || !adminEditedSnapshot;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مقارنة تعديلات إدارة الجودة والتدريب (اللقطات الرسمية)"
      description="مقارنة تفصيلية بين النسخة المقدمة من المحاضر للاعتماد والنسخة المعدلة رسمياً من إدارة التدريب والجودة."
      size="xl"
      className="max-w-5xl"
      dataTestId={testId}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Icon name="info" size="sm" className="text-primary" />
            <span>
              إجمالي التغييرات المرصودة: <strong className="text-text font-bold" data-testid="total-diff-count">{totalChangesCount}</strong>
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} data-testid="close-diff-modal-btn">
            إغلاق أداة المقارنة
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-1 text-xs" dir="rtl">
        {/* Missing Snapshots Fallback State */}
        {hasMissingSnapshots ? (
          <div
            className="p-8 text-center rounded-xl bg-surface-muted border border-border space-y-3"
            data-testid="missing-snapshots-notice"
          >
            <div className="w-12 h-12 rounded-full bg-warning/10 text-warning-dark flex items-center justify-center mx-auto">
              <Icon name="alert" size="md" />
            </div>
            <h3 className="text-sm font-bold text-text-heading">
              اللقطات التاريخية للمقرر غير متوفرة بالكامل
            </h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              تعذر استرجاع نسختين مكتملتين للمقارنة المباشرة. يتم تسجيل اللقطات الرسمية تلقائياً عند صدور قرار إعادة المقرر مع تعديلات الإدارة.
            </p>
          </div>
        ) : (
          <>
            {/* Snapshot Metadata Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-muted/60 border border-border text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral" size="sm" className="font-bold">
                    النسخة المقدمة (الأصل)
                  </Badge>
                  <span className="font-mono text-[11px] text-text-muted truncate">
                    {baselineSnapshot.id}
                  </span>
                </div>
                <div className="text-[11px] text-text-muted">
                  تاريخ التقديم:{' '}
                  <strong className="text-text" data-testid="baseline-date">
                    {formatSnapshotDate(baselineSnapshot.submittedAt || baselineSnapshot.capturedAt)}
                  </strong>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="warning" size="sm" className="font-bold">
                    تعديلات إدارة الجودة
                  </Badge>
                  <span className="text-[11px] text-text-muted">نسخة المراجعة المعتمدة</span>
                </div>
                <div className="text-[11px] text-text-muted">
                  تاريخ الحفظ والاعتماد:{' '}
                  <strong className="text-text" data-testid="admin-date">
                    {formatSnapshotDate(adminEditedSnapshot.capturedAt)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'all'
                      ? 'bg-primary text-surface font-semibold shadow-2xs'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                  data-testid="diff-tab-all"
                >
                  الكل ({totalChangesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('metadata')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'metadata'
                      ? 'bg-primary text-surface font-semibold shadow-2xs'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                  data-testid="diff-tab-metadata"
                >
                  البيانات الأساسية ({metadataDiffs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('chapters')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'chapters'
                      ? 'bg-primary text-surface font-semibold shadow-2xs'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                  data-testid="diff-tab-chapters"
                >
                  الفصول ({chapterDiffs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('lessons')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'lessons'
                      ? 'bg-primary text-surface font-semibold shadow-2xs'
                      : 'bg-surface-muted text-text-muted hover:text-text'
                  }`}
                  data-testid="diff-tab-lessons"
                >
                  الدروس والمحتويات ({lessonDiffs.length})
                </button>
              </div>

              {/* Search Filter */}
              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  placeholder="تصفية التغييرات..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full px-3 py-1 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:border-primary"
                  data-testid="diff-search-input"
                />
              </div>
            </div>

            {/* Zero Diffs State */}
            {totalChangesCount === 0 && (
              <div
                className="p-8 text-center rounded-xl bg-surface-muted border border-border space-y-2"
                data-testid="no-changes-notice"
              >
                <Icon name="checkCircle" size="lg" className="text-success mx-auto" />
                <h3 className="text-sm font-bold text-text-heading">لا توجد أي تغييرات مرصودة</h3>
                <p className="text-xs text-text-muted">
                  محتويات اللقطة المقدمة من المحاضر مطابقة تماماً للنسخة المعدلة من الإدارة.
                </p>
              </div>
            )}

            {/* 1. METADATA DIFF SECTION */}
            {(activeTab === 'all' || activeTab === 'metadata') && filteredMetadata.length > 0 && (
              <div className="space-y-2" data-testid="metadata-diff-section">
                <h4 className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="fileText" size="sm" className="text-primary" />
                  <span>تعديلات البيانات الأساسية للمقرر ({filteredMetadata.length})</span>
                </h4>

                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-surface-muted text-text-muted font-bold border-b border-border">
                      <tr>
                        <th className="p-3 w-1/4">الحقل</th>
                        <th className="p-3 w-3/8">النسخة المقدمة (المحاضر)</th>
                        <th className="p-3 w-3/8">تعديل إدارة الجودة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredMetadata.map((field) => (
                        <tr key={field.key} data-testid={`metadata-diff-row-${field.key}`}>
                          <td className="p-3 font-semibold text-text">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="warning" size="sm">
                                معدل
                              </Badge>
                              <span>{field.label}</span>
                            </div>
                          </td>
                          <td className="p-3 text-text-muted bg-danger/5" data-testid={`baseline-${field.key}`}>
                            <span className="line-through">{field.baselineValue}</span>
                          </td>
                          <td className="p-3 text-text font-medium bg-success/5" data-testid={`admin-${field.key}`}>
                            <span>{field.adminEditedValue}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Detailed Course External Resources Breakdown */}
                {courseResourceDiffs.length > 0 && (
                  <div
                    className="p-3 rounded-xl border border-border bg-surface-muted/50 space-y-2 mt-2"
                    data-testid="course-resource-diffs-panel"
                  >
                    <div className="font-bold text-xs text-text-heading flex items-center gap-1.5">
                      <Icon name="link" size="sm" className="text-primary" />
                      <span>تفاصيل تعديل المصادر الخارجية للمقرر ({courseResourceDiffs.length}):</span>
                    </div>
                    <div className="space-y-1.5">
                      {courseResourceDiffs.map((rd) => (
                        <div
                          key={rd.id}
                          className="p-2 rounded-lg border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          data-testid={`course-resource-diff-${rd.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {rd.diffType === 'added' && (
                              <Badge variant="success" size="sm" className="font-bold">
                                مصدر مضاف
                              </Badge>
                            )}
                            {rd.diffType === 'removed' && (
                              <Badge variant="danger" size="sm" className="font-bold">
                                مصدر محذوف
                              </Badge>
                            )}
                            {rd.diffType === 'modified' && (
                              <Badge variant="warning" size="sm" className="font-bold">
                                مصدر معدل
                              </Badge>
                            )}
                            <span className="font-bold text-text">{rd.title}</span>
                          </div>
                          <div className="text-[11px] text-text-muted flex items-center gap-2">
                            {rd.baselineUrl && (
                              <span
                                className={
                                  rd.diffType === 'removed' ||
                                  (rd.diffType === 'modified' && rd.baselineUrl !== rd.adminUrl)
                                    ? 'line-through text-danger'
                                    : ''
                                }
                              >
                                {rd.baselineUrl}
                              </span>
                            )}
                            {rd.diffType === 'modified' && rd.baselineUrl !== rd.adminUrl && (
                              <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                            )}
                            {rd.adminUrl && rd.diffType !== 'removed' && (
                              <span className="font-medium text-success">{rd.adminUrl}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. CHAPTERS DIFF SECTION */}
            {(activeTab === 'all' || activeTab === 'chapters') && filteredChapters.length > 0 && (
              <div className="space-y-2" data-testid="chapters-diff-section">
                <h4 className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="courses" size="sm" className="text-primary" />
                  <span>تعديلات فصول المنهج ({filteredChapters.length})</span>
                </h4>

                <div className="space-y-2">
                  {filteredChapters.map((ch) => (
                    <div
                      key={ch.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        ch.diffType === 'added'
                          ? 'bg-success/5 border-success/30'
                          : ch.diffType === 'removed'
                          ? 'bg-danger/5 border-danger/30'
                          : 'bg-warning/5 border-warning/30'
                      }`}
                      data-testid={`chapter-diff-${ch.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {ch.diffType === 'added' && (
                          <Badge variant="success" size="sm" className="font-bold">
                            فصل مضاف
                          </Badge>
                        )}
                        {ch.diffType === 'removed' && (
                          <Badge variant="danger" size="sm" className="font-bold">
                            فصل محذوف
                          </Badge>
                        )}
                        {ch.diffType === 'modified' && (
                          <Badge variant="warning" size="sm" className="font-bold">
                            فصل معدل
                          </Badge>
                        )}

                        <span className="font-bold text-text text-xs">
                          {ch.title}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          (معرف: {ch.id})
                        </span>
                      </div>

                      {ch.diffType === 'modified' && ch.baselineTitle && ch.baselineTitle !== ch.adminTitle && (
                        <div className="text-[11px] text-text-muted flex items-center gap-2">
                          <span className="line-through text-danger">{ch.baselineTitle}</span>
                          <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                          <span className="font-bold text-success">{ch.adminTitle}</span>
                        </div>
                      )}

                      {ch.isOrderChanged && (
                        <div className="text-[11px] text-text-muted">
                          الترتيب: من {ch.baselineOrder} إلى {ch.adminOrder}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. LESSONS DIFF SECTION */}
            {(activeTab === 'all' || activeTab === 'lessons') && filteredLessons.length > 0 && (
              <div className="space-y-2" data-testid="lessons-diff-section">
                <h4 className="text-xs font-bold text-text-heading flex items-center gap-1.5">
                  <Icon name="bookOpen" size="sm" className="text-primary" />
                  <span>تعديلات الدروس والمحتويات التدريبية ({filteredLessons.length})</span>
                </h4>

                <div className="space-y-2">
                  {filteredLessons.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.diffType === 'added'
                          ? 'bg-success/5 border-success/30'
                          : item.diffType === 'removed'
                          ? 'bg-danger/5 border-danger/30'
                          : 'bg-warning/5 border-warning/30'
                      }`}
                      data-testid={`lesson-diff-${item.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.diffType === 'added' && (
                            <Badge variant="success" size="sm" className="font-bold">
                              درس مضاف
                            </Badge>
                          )}
                          {item.diffType === 'removed' && (
                            <Badge variant="danger" size="sm" className="font-bold">
                              درس محذوف
                            </Badge>
                          )}
                          {item.diffType === 'modified' && (
                            <Badge variant="warning" size="sm" className="font-bold">
                              درس معدل
                            </Badge>
                          )}

                          <span className="font-bold text-text text-xs">
                            {item.title}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">
                            (معرف: {item.id})
                          </span>
                        </div>

                        {/* Attribute changes breakdown */}
                        {item.diffType === 'modified' && (
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted pt-0.5">
                            {item.baselineTitle !== item.adminTitle && (
                              <div className="flex items-center gap-1">
                                <span>العنوان:</span>
                                <span className="line-through text-danger">{item.baselineTitle}</span>
                                <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                                <span className="font-bold text-success">{item.adminTitle}</span>
                              </div>
                            )}

                            {item.baselineType !== item.adminType && (
                              <div className="flex items-center gap-1">
                                <span>النوع:</span>
                                <span className="line-through text-danger">{item.baselineType}</span>
                                <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                                <span className="font-bold text-success">{item.adminType}</span>
                              </div>
                            )}

                            {item.baselineDuration !== item.adminDuration && (
                              <div className="flex items-center gap-1">
                                <span>المدة:</span>
                                <span className="line-through text-danger">{item.baselineDuration || 'غير محدد'}</span>
                                <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                                <span className="font-bold text-success">{item.adminDuration}</span>
                              </div>
                            )}

                            {item.baselineDownloadPolicy !== item.adminDownloadPolicy && (
                              <div className="flex items-center gap-1">
                                <span>سياسة التنزيل:</span>
                                <span className="line-through text-danger">
                                  {item.baselineDownloadPolicy === 'never' ? 'غير قابل للتنزيل' : 'قابل للتنزيل'}
                                </span>
                                <Icon name="chevronLeft" size="sm" className="text-text-muted" />
                                <span className="font-bold text-success">
                                  {item.adminDownloadPolicy === 'never' ? 'غير قابل للتنزيل' : 'قابل للتنزيل'}
                                </span>
                              </div>
                            )}

                            {/* Lesson-level External Resources breakdown */}
                            {item.resourceDiffs && item.resourceDiffs.length > 0 && (
                              <div
                                className="w-full flex flex-wrap items-center gap-2 pt-1.5 border-t border-border/50 text-[11px]"
                                data-testid={`lesson-resource-diffs-${item.id}`}
                              >
                                <span className="font-bold text-text-heading">
                                  المصادر المرفقة ({item.resourceDiffs.length}):
                                </span>
                                {item.resourceDiffs.map((rd) => (
                                  <span
                                    key={rd.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-surface border border-border"
                                    data-testid={`lesson-resource-diff-${rd.id}`}
                                  >
                                    {rd.diffType === 'added' && (
                                      <Badge variant="success" size="sm">
                                        مضاف
                                      </Badge>
                                    )}
                                    {rd.diffType === 'removed' && (
                                      <Badge variant="danger" size="sm">
                                        محذوف
                                      </Badge>
                                    )}
                                    {rd.diffType === 'modified' && (
                                      <Badge variant="warning" size="sm">
                                        معدل
                                      </Badge>
                                    )}
                                    <span className="font-medium text-text">{rd.title}</span>
                                    {rd.diffType === 'modified' && rd.baselineUrl !== rd.adminUrl && (
                                      <span className="text-text-muted font-mono">({rd.adminUrl})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-text-muted shrink-0">
                        فصل: {item.chapterId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default CourseDiffViewerModal;
