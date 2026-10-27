import type {
  CourseChapter,
  ChapterItem,
  RefresherCourseConfig,
} from './types';

/**
 * Checks whether an individual content item is visible in the refresher version.
 * Business Rule: Content items default to visible (true) in the refresher version
 * unless an explicit saved setting specifies isVisible: false.
 */
export function isItemVisibleInRefresher(
  itemId: string,
  config?: RefresherCourseConfig
): boolean {
  if (!config) return true;
  const itemSetting = config.items?.[itemId];
  if (!itemSetting) return true; // Default newly configured items to visible
  return itemSetting.isVisible !== false;
}

/**
 * Retrieves the effective display title for a content item in the refresher version.
 * If a refresher-specific name override is defined, it is used; otherwise, the original title is preserved.
 */
export function getRefresherItemTitle(
  item: ChapterItem,
  config?: RefresherCourseConfig
): string {
  const custom = config?.items?.[item.id]?.customTitle?.trim();
  return custom || item.title;
}

/**
 * Checks if a specific content item has an explicit custom title override for the refresher version.
 */
export function hasRefresherTitleOverride(
  itemId: string,
  config?: RefresherCourseConfig
): boolean {
  return Boolean(config?.items?.[itemId]?.customTitle?.trim());
}

/**
 * Retrieves the effective display title for a chapter/section in the refresher version.
 * If a refresher-specific chapter title override is defined, it is used; otherwise, the original title is preserved.
 */
export function getRefresherChapterTitle(
  chapter: CourseChapter,
  config?: RefresherCourseConfig
): string {
  const custom = config?.chapters?.[chapter.id]?.customTitle?.trim();
  return custom || chapter.title;
}

/**
 * Checks if a specific chapter has an explicit custom title override for the refresher version.
 */
export function hasRefresherChapterTitleOverride(
  chapterId: string,
  config?: RefresherCourseConfig
): boolean {
  return Boolean(config?.chapters?.[chapterId]?.customTitle?.trim());
}

/**
 * Generates the effective course structure for the refresher version.
 * - Filters out items that are marked as hidden in the refresher version.
 * - Applies refresher-specific display name overrides to both chapters and items.
 * - Excludes chapters that have zero visible refresher items (never shows empty sections).
 * - Preserves original media references, URLs, durations, and download policies.
 */
export function getEffectiveRefresherChapters(
  chapters: CourseChapter[],
  config?: RefresherCourseConfig
): CourseChapter[] {
  if (!config?.enabled) {
    return [];
  }

  return chapters
    .map((chapter) => {
      const visibleItems = chapter.items
        .filter((item) => isItemVisibleInRefresher(item.id, config))
        .map((item) => ({
          ...item,
          title: getRefresherItemTitle(item, config),
        }));

      return {
        ...chapter,
        title: getRefresherChapterTitle(chapter, config),
        items: visibleItems,
      };
    })
    .filter((chapter) => chapter.items.length > 0);
}

/**
 * Calculates summary metrics for the refresher version.
 */
export function calculateRefresherStats(
  chapters: CourseChapter[],
  config?: RefresherCourseConfig
) {
  let totalOriginalItems = 0;
  let visibleRefresherItems = 0;
  let customTitlesCount = 0;
  let activeChaptersCount = 0;

  chapters.forEach((chapter) => {
    let chapterHasVisible = false;
    if (hasRefresherChapterTitleOverride(chapter.id, config)) {
      customTitlesCount += 1;
    }
    chapter.items.forEach((item) => {
      totalOriginalItems += 1;
      const isVisible = isItemVisibleInRefresher(item.id, config);
      if (isVisible) {
        visibleRefresherItems += 1;
        chapterHasVisible = true;
      }
      if (hasRefresherTitleOverride(item.id, config)) {
        customTitlesCount += 1;
      }
    });
    if (chapterHasVisible) {
      activeChaptersCount += 1;
    }
  });

  return {
    totalChapters: chapters.length,
    activeChaptersCount,
    totalOriginalItems,
    visibleRefresherItems,
    hiddenItemsCount: totalOriginalItems - visibleRefresherItems,
    customTitlesCount,
  };
}

/**
 * Inspects whether an edit or delete operation on original course content
 * has a meaningful impact on an enabled refresher version.
 *
 * Requirements:
 * - Warns before original changes affect the refresher.
 * - Does not show false-positive warnings (e.g. renaming an original item
 *   that already has a refresher-specific name override does not change its refresher display name).
 */
export interface RefresherImpactAssessment {
  hasImpact: boolean;
  impactMessage?: string;
}

export type RefresherImpactOperation =
  | 'delete_item'
  | 'delete_chapter'
  | 'add_item'
  | 'move_item'
  | 'move_chapter'
  | 'edit_chapter'
  | 'edit_item';

export interface RefresherImpactContext {
  refresherConfig?: RefresherCourseConfig;
  originalItem?: ChapterItem;
  updatedItem?: ChapterItem;
  newItem?: ChapterItem;
  chapter?: CourseChapter;
  chapters?: CourseChapter[];
  newTitle?: string;
  direction?: 'up' | 'down';
  itemIndex?: number;
  index?: number;
}

export function assessRefresherImpact(
  operation: RefresherImpactOperation,
  context: RefresherImpactContext
): RefresherImpactAssessment {
  const {
    refresherConfig,
    originalItem,
    updatedItem,
    newItem,
    chapter,
    chapters,
    newTitle,
    direction,
    itemIndex,
    index,
  } = context;

  // If refresher version is not enabled for the course, there is zero impact
  if (!refresherConfig?.enabled) {
    return { hasImpact: false };
  }

  // 1. Delete Item
  if (operation === 'delete_item' && originalItem) {
    const isVisibleInRefresher = isItemVisibleInRefresher(originalItem.id, refresherConfig);
    if (isVisibleInRefresher) {
      return {
        hasImpact: true,
        impactMessage: `حذف المحتوى "${originalItem.title}" سيؤدي أيضًا إلى استبعاده من النسخة التذكيرية المفعلة للمقرر. هل تريد المتابعة؟`,
      };
    }
    return { hasImpact: false };
  }

  // 2. Delete Chapter
  if (operation === 'delete_chapter' && chapter) {
    const visibleCount = chapter.items.filter((it) =>
      isItemVisibleInRefresher(it.id, refresherConfig)
    ).length;
    if (visibleCount > 0) {
      return {
        hasImpact: true,
        impactMessage: `حذف الفصل "${chapter.title}" سيؤدي أيضًا إلى إزالة ${visibleCount} محتوى تابع له من النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }
    return { hasImpact: false };
  }

  // 3. Add Item to Chapter
  if (operation === 'add_item' && newItem) {
    // Business rule: newly configured items default to visible in the refresher version
    const willBeVisible = isItemVisibleInRefresher(newItem.id, refresherConfig);
    if (willBeVisible) {
      return {
        hasImpact: true,
        impactMessage: `إضافة الدرس "${newItem.title}" سيؤدي أيضًا إلى إدراجه تلقائيًا ضمن النسخة التذكيرية المفعلة للمقرر. هل تريد المتابعة؟`,
      };
    }
    return { hasImpact: false };
  }

  // 4. Move / Reorder Item within Chapter
  if (operation === 'move_item' && originalItem && chapter && itemIndex !== undefined && direction) {
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (targetIndex >= 0 && targetIndex < chapter.items.length) {
      const targetItem = chapter.items[targetIndex];
      const isCurrentVisible = isItemVisibleInRefresher(originalItem.id, refresherConfig);
      const isTargetVisible = isItemVisibleInRefresher(targetItem.id, refresherConfig);

      // Reordering affects the refresher version if at least one of the swapped items is visible in it
      if (isCurrentVisible || isTargetVisible) {
        return {
          hasImpact: true,
          impactMessage: `تغيير ترتيب الدرس "${originalItem.title}" سيؤثر أيضًا على تسلسل المحتوى في النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
        };
      }
    }
    return { hasImpact: false };
  }

  // 5. Move / Reorder Chapters
  if (operation === 'move_chapter' && chapters && index !== undefined && direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < chapters.length) {
      const currentChapter = chapters[index];
      const targetChapter = chapters[targetIndex];

      const currentHasVisible = currentChapter.items.some((it) =>
        isItemVisibleInRefresher(it.id, refresherConfig)
      );
      const targetHasVisible = targetChapter.items.some((it) =>
        isItemVisibleInRefresher(it.id, refresherConfig)
      );

      if (currentHasVisible || targetHasVisible) {
        return {
          hasImpact: true,
          impactMessage: `تغيير ترتيب الفصول سيؤثر أيضًا على تسلسل الفصول في النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
        };
      }
    }
    return { hasImpact: false };
  }

  // 6. Edit Chapter Title
  if (operation === 'edit_chapter' && chapter && newTitle !== undefined) {
    if (chapter.title.trim() === newTitle.trim()) {
      return { hasImpact: false };
    }

    // Check if this chapter already has an explicit custom title override for refresher
    const hasCustomTitle = hasRefresherChapterTitleOverride(chapter.id, refresherConfig);
    if (hasCustomTitle) {
      // The refresher display title is protected by its custom override,
      // so editing the original chapter title has zero impact on the refresher version!
      return { hasImpact: false };
    }

    const visibleCount = chapter.items.filter((it) =>
      isItemVisibleInRefresher(it.id, refresherConfig)
    ).length;
    if (visibleCount > 0) {
      return {
        hasImpact: true,
        impactMessage: `تعديل عنوان الفصل "${chapter.title}" سيؤدي أيضًا إلى تحديث اسمه في النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }
    return { hasImpact: false };
  }

  // 7. Edit Item Properties
  if (operation === 'edit_item' && originalItem && updatedItem) {
    const isVisibleInRefresher = isItemVisibleInRefresher(originalItem.id, refresherConfig);
    if (!isVisibleInRefresher) {
      // Hidden items in refresher are completely unaffected
      return { hasImpact: false };
    }

    const hasCustomTitle = hasRefresherTitleOverride(originalItem.id, refresherConfig);
    const titleChanged = originalItem.title.trim() !== updatedItem.title.trim();

    // Check media / video / file changes
    const mediaChanged =
      originalItem.url !== updatedItem.url ||
      originalItem.type !== updatedItem.type ||
      originalItem.videoSourceType !== updatedItem.videoSourceType ||
      originalItem.driveFileId !== updatedItem.driveFileId ||
      originalItem.youtubeVideoId !== updatedItem.youtubeVideoId ||
      originalItem.mediaId !== updatedItem.mediaId;

    // Check file/document metadata replacement (PDF, image, docx, zip)
    const fileMetadataChanged =
      originalItem.type !== 'video' &&
      (originalItem.originalFileName !== updatedItem.originalFileName ||
        originalItem.fileSizeBytes !== updatedItem.fileSizeBytes ||
        originalItem.mimeType !== updatedItem.mimeType);

    // Check duration and completion policy changes
    const durationChanged = originalItem.duration !== updatedItem.duration;
    const completionPolicyChanged =
      originalItem.completionPolicy?.requireMinimumViewingTime !==
      updatedItem.completionPolicy?.requireMinimumViewingTime;

    // Check download policy changes
    const downloadPolicyChanged =
      originalItem.downloadPolicy !== updatedItem.downloadPolicy ||
      originalItem.canDownload !== updatedItem.canDownload;

    // Check embed policy & external resources
    const embedPolicyChanged =
      originalItem.embedPolicy?.cropTopPixels !== updatedItem.embedPolicy?.cropTopPixels ||
      originalItem.embedPolicy?.blockPopups !== updatedItem.embedPolicy?.blockPopups;
    const resourcesChanged =
      JSON.stringify(originalItem.externalResources || []) !==
      JSON.stringify(updatedItem.externalResources || []);

    // If title changed without a custom title override, it directly renames the refresher item
    if (titleChanged && !hasCustomTitle) {
      return {
        hasImpact: true,
        impactMessage: `تعديل عنوان الدرس "${originalItem.title}" سيؤدي إلى تحديث اسمه في النسخة التذكيرية للمقرر (حيث لا يوجد اسم مخصص له بالتذكيري). هل تريد المتابعة؟`,
      };
    }

    if (mediaChanged) {
      return {
        hasImpact: true,
        impactMessage: `تعديل ملف أو رابط الفيديو للدرس "${originalItem.title}" سيؤثر أيضًا على محتوى الفيديو في النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }

    if (fileMetadataChanged) {
      return {
        hasImpact: true,
        impactMessage: `استبدال أو تعديل الملف المرفق للدرس "${originalItem.title}" سيؤثر أيضًا على محتواه في النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }

    if (durationChanged || completionPolicyChanged) {
      return {
        hasImpact: true,
        impactMessage: `تعديل مدة أو سياسة إتمام الدرس "${originalItem.title}" سيؤثر أيضًا على متطلبات النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }

    if (downloadPolicyChanged || embedPolicyChanged || resourcesChanged) {
      return {
        hasImpact: true,
        impactMessage: `تعديل إعدادات وسياسات الدرس "${originalItem.title}" سيؤثر أيضًا على النسخة التذكيرية للمقرر. هل تريد المتابعة؟`,
      };
    }

    // Notice: If ONLY title changed, but this item HAS a custom title override (hasCustomTitle === true),
    // and none of the other properties changed, hasImpact remains false!
    return { hasImpact: false };
  }

  return { hasImpact: false };
}
