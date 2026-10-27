import type { Course, CourseChapter, ChapterItem } from '@/core/courses/types';

export interface FieldConflict {
  field: string;
  path: string;
  label: string;
  baseValue: unknown;
  serverValue: unknown;
  localValue: unknown;
}

export interface ThreeWayRebaseResult {
  hasConflict: boolean;
  conflicts: FieldConflict[];
  mergedPatch: Partial<Course>;
}

export const ALLOWED_STAGED_METADATA_FIELDS: (keyof Course)[] = [
  'title',
  'description',
  'level',
  'estimatedHours',
  'coverType',
  'coverColor',
  'thumbnail',
  'targetJobTitles',
  'prerequisiteCourseId',
  'prerequisiteCourseIds',
  'knowledgePrerequisites',
  'externalResources',
  'courseZipPolicy',
  'commentsEnabled',
  'refresherConfig',
];

const FIELD_LABELS: Record<string, string> = {
  title: 'عنوان المقرر',
  description: 'وصف المقرر',
  level: 'مستوى المقرر',
  estimatedHours: 'الساعات التقديرية',
  coverType: 'نوع الغلاف',
  coverColor: 'لون الغلاف',
  thumbnail: 'صورة الغلاف',
  targetJobTitles: 'المسميات الوظيفية المستهدفة',
  prerequisiteCourseId: 'المقرر السابق المطلوب',
  prerequisiteCourseIds: 'المقررات السابقة المطلوبة',
  knowledgePrerequisites: 'المتطلبات المعرفية',
  externalResources: 'المصادر الخارجية',
  courseZipPolicy: 'سياسة تنزيل المحتوى',
  commentsEnabled: 'تفعيل التعليقات',
  refresherConfig: 'إعدادات النسخة التنشيطية',
  chapters: 'المنهج الدراسي',
};

export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Three-Way Rebase Service for Concurrent Review Staging
 *
 * Merges concurrent edits across:
 * - Base: Authoritative baseline course content at the start of review session.
 * - Server: Latest accepted staged content record from server.
 * - Local: Administrator's pending local modifications.
 *
 * Automatically merges non-overlapping changes (e.g. metadata vs curriculum,
 * separate chapters, separate lessons, curriculum reorder vs lesson rename).
 * Flags overlapping conflicts cleanly and prevents stale full-curriculum
 * payloads from overwriting newer accepted edits.
 */
export function threeWayRebase(
  base: Course,
  serverPatch: Partial<Course>,
  localPatch: Partial<Course>
): ThreeWayRebaseResult {
  const conflicts: FieldConflict[] = [];
  const mergedPatch: Partial<Course> = {};

  // 1. Rebase Metadata Fields
  for (const field of ALLOWED_STAGED_METADATA_FIELDS) {
    const baseVal = base[field];
    const serverHas = field in serverPatch;
    const localHas = field in localPatch;

    const serverVal = serverHas ? serverPatch[field] : baseVal;
    const localVal = localHas ? localPatch[field] : baseVal;

    const serverChanged = serverHas && !isDeepEqual(serverVal, baseVal);
    const localChanged = localHas && !isDeepEqual(localVal, baseVal);

    if (localChanged && !serverChanged) {
      // Local only changed
      Reflect.set(mergedPatch, field, localVal);
    } else if (serverChanged && !localChanged) {
      // Server only changed
      Reflect.set(mergedPatch, field, serverVal);
    } else if (localChanged && serverChanged) {
      // Both modified this field
      if (isDeepEqual(localVal, serverVal)) {
        // Both applied identical change -> no conflict
        Reflect.set(mergedPatch, field, localVal);
      } else {
        // Overlapping conflict!
        conflicts.push({
          field: String(field),
          path: String(field),
          label: FIELD_LABELS[String(field)] || String(field),
          baseValue: baseVal,
          serverValue: serverVal,
          localValue: localVal,
        });
        // Tentatively adopt local value in merged patch
        Reflect.set(mergedPatch, field, localVal);
      }
    } else if (serverHas) {
      Reflect.set(mergedPatch, field, serverVal);
    } else if (localHas) {
      Reflect.set(mergedPatch, field, localVal);
    }
  }

  // 2. Rebase Curriculum / Chapters
  const baseChapters = base.chapters || [];
  const serverChapters = serverPatch.chapters ?? baseChapters;
  const localChapters = localPatch.chapters ?? baseChapters;

  const serverChangedChapters =
    'chapters' in serverPatch && !isDeepEqual(serverPatch.chapters, baseChapters);
  const localChangedChapters =
    'chapters' in localPatch && !isDeepEqual(localPatch.chapters, baseChapters);

  if (localChangedChapters && !serverChangedChapters) {
    // Only local modified chapters (server did not modify curriculum)
    mergedPatch.chapters = JSON.parse(JSON.stringify(localPatch.chapters));
  } else if (serverChangedChapters && !localChangedChapters) {
    // Only server modified chapters (or local sent stale unchanged curriculum)
    mergedPatch.chapters = JSON.parse(JSON.stringify(serverPatch.chapters));
  } else if (!serverChangedChapters && !localChangedChapters) {
    // Neither modified chapters from base
    if ('chapters' in serverPatch) {
      mergedPatch.chapters = JSON.parse(JSON.stringify(serverPatch.chapters));
    } else if ('chapters' in localPatch) {
      mergedPatch.chapters = JSON.parse(JSON.stringify(localPatch.chapters));
    }
  } else {
    // Both server and local modified chapters! Structural 3-way merge
    const mergedChaptersResult = mergeChapters(baseChapters, serverChapters, localChapters, conflicts);
    mergedPatch.chapters = mergedChaptersResult;
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    mergedPatch,
  };
}

/**
 * Structural 3-Way Merge for Chapters & Lessons Hierarchy
 */
function mergeChapters(
  baseChapters: CourseChapter[],
  serverChapters: CourseChapter[],
  localChapters: CourseChapter[],
  conflicts: FieldConflict[]
): CourseChapter[] {
  // A. Chapter Ordering Resolution
  const baseChOrder = baseChapters.map((c) => c.id);
  const serverChOrder = serverChapters.map((c) => c.id);
  const localChOrder = localChapters.map((c) => c.id);

  // Compare relative order of existing chapters that were present in base
  const serverExistingChOrder = serverChOrder.filter((id) => baseChOrder.includes(id));
  const localExistingChOrder = localChOrder.filter((id) => baseChOrder.includes(id));

  const serverOrderChanged = !isDeepEqual(serverExistingChOrder, baseChOrder);
  const localOrderChanged = !isDeepEqual(localExistingChOrder, baseChOrder);

  let targetChOrder: string[];
  if (localOrderChanged && !serverOrderChanged) {
    targetChOrder = [...localChOrder];
  } else if (serverOrderChanged && !localOrderChanged) {
    targetChOrder = [...serverChOrder];
  } else if (!serverOrderChanged && !localOrderChanged) {
    targetChOrder = [...baseChOrder];
  } else {
    // Both reordered existing chapters
    if (isDeepEqual(serverExistingChOrder, localExistingChOrder)) {
      targetChOrder = [...localChOrder];
    } else {
      conflicts.push({
        field: 'chapters.order',
        path: 'chapters.order',
        label: 'ترتيب فصول المقرر',
        baseValue: baseChOrder,
        serverValue: serverChOrder,
        localValue: localChOrder,
      });
      targetChOrder = [...localChOrder];
    }
  }

  // Ensure any newly added chapters are included in the target order
  for (const ch of serverChapters) {
    if (!targetChOrder.includes(ch.id)) targetChOrder.push(ch.id);
  }
  for (const ch of localChapters) {
    if (!targetChOrder.includes(ch.id)) targetChOrder.push(ch.id);
  }

  const mergedChapters: CourseChapter[] = [];

  for (const chId of targetChOrder) {
    const baseCh = baseChapters.find((c) => c.id === chId);
    const serverCh = serverChapters.find((c) => c.id === chId);
    const localCh = localChapters.find((c) => c.id === chId);

    // 1. Chapter added only in server
    if (!baseCh && serverCh && !localCh) {
      mergedChapters.push(JSON.parse(JSON.stringify(serverCh)));
      continue;
    }

    // 2. Chapter added only in local
    if (!baseCh && !serverCh && localCh) {
      mergedChapters.push(JSON.parse(JSON.stringify(localCh)));
      continue;
    }

    // 3. Chapter deleted in local
    if (baseCh && serverCh && !localCh) {
      if (!isDeepEqual(serverCh, baseCh)) {
        conflicts.push({
          field: 'chapter.deleted',
          path: `chapters.${chId}`,
          label: `حذف الفصل: ${baseCh.title}`,
          baseValue: baseCh.title,
          serverValue: serverCh.title,
          localValue: '[تم حذفه محلياً]',
        });
        mergedChapters.push(JSON.parse(JSON.stringify(serverCh)));
      }
      // If server didn't modify it, deletion is accepted
      continue;
    }

    // 4. Chapter deleted in server
    if (baseCh && !serverCh && localCh) {
      if (!isDeepEqual(localCh, baseCh)) {
        conflicts.push({
          field: 'chapter.deleted',
          path: `chapters.${chId}`,
          label: `حذف الفصل: ${baseCh.title}`,
          baseValue: baseCh.title,
          serverValue: '[تم حذفه على الخادم]',
          localValue: localCh.title,
        });
        mergedChapters.push(JSON.parse(JSON.stringify(localCh)));
      }
      continue;
    }

    // 5. Chapter exists in both (or both created a chapter with identical ID)
    if (serverCh && localCh) {
      const mergedCh: CourseChapter = {
        id: chId,
        title: baseCh?.title || localCh.title,
        order: mergedChapters.length + 1,
        items: [],
      };

      // Merge Chapter Title
      const baseTitle = baseCh?.title;
      const serverTitle = serverCh.title;
      const localTitle = localCh.title;

      const serverTitleChanged = serverTitle !== baseTitle;
      const localTitleChanged = localTitle !== baseTitle;

      if (localTitleChanged && !serverTitleChanged) {
        mergedCh.title = localTitle;
      } else if (serverTitleChanged && !localTitleChanged) {
        mergedCh.title = serverTitle;
      } else if (localTitleChanged && serverTitleChanged) {
        if (localTitle === serverTitle) {
          mergedCh.title = localTitle;
        } else {
          conflicts.push({
            field: 'chapter.title',
            path: `chapters.${chId}.title`,
            label: `عنوان الفصل (${baseTitle || chId})`,
            baseValue: baseTitle,
            serverValue: serverTitle,
            localValue: localTitle,
          });
          mergedCh.title = localTitle;
        }
      } else {
        mergedCh.title = baseTitle || localTitle;
      }

      // Merge Lessons (Items) within this chapter
      mergedCh.items = mergeChapterItems(
        chId,
        baseCh?.items || [],
        serverCh.items || [],
        localCh.items || [],
        conflicts
      );

      mergedChapters.push(mergedCh);
    }
  }

  // Normalize order numbers
  return mergedChapters.map((ch, idx) => ({ ...ch, order: idx + 1 }));
}

/**
 * Structural 3-Way Merge for Chapter Items / Lessons
 */
function mergeChapterItems(
  chapterId: string,
  baseItems: ChapterItem[],
  serverItems: ChapterItem[],
  localItems: ChapterItem[],
  conflicts: FieldConflict[]
): ChapterItem[] {
  const baseOrder = baseItems.map((i) => i.id);
  const serverOrder = serverItems.map((i) => i.id);
  const localOrder = localItems.map((i) => i.id);

  // Compare relative order of existing items that were present in base
  const serverExistingOrder = serverOrder.filter((id) => baseOrder.includes(id));
  const localExistingOrder = localOrder.filter((id) => baseOrder.includes(id));

  const serverOrderChanged = !isDeepEqual(serverExistingOrder, baseOrder);
  const localOrderChanged = !isDeepEqual(localExistingOrder, baseOrder);

  let targetOrder: string[];
  if (localOrderChanged && !serverOrderChanged) {
    targetOrder = [...localOrder];
  } else if (serverOrderChanged && !localOrderChanged) {
    targetOrder = [...serverOrder];
  } else if (!serverOrderChanged && !localOrderChanged) {
    targetOrder = [...baseOrder];
  } else {
    if (isDeepEqual(serverExistingOrder, localExistingOrder)) {
      targetOrder = [...localOrder];
    } else {
      conflicts.push({
        field: 'items.order',
        path: `chapters.${chapterId}.items.order`,
        label: `ترتيب دروس الفصل (${chapterId})`,
        baseValue: baseOrder,
        serverValue: serverOrder,
        localValue: localOrder,
      });
      targetOrder = [...localOrder];
    }
  }

  for (const item of serverItems) {
    if (!targetOrder.includes(item.id)) targetOrder.push(item.id);
  }
  for (const item of localItems) {
    if (!targetOrder.includes(item.id)) targetOrder.push(item.id);
  }

  const mergedItems: ChapterItem[] = [];

  for (const itemId of targetOrder) {
    const baseItem = baseItems.find((i) => i.id === itemId);
    const serverItem = serverItems.find((i) => i.id === itemId);
    const localItem = localItems.find((i) => i.id === itemId);

    // 1. Added only in server
    if (!baseItem && serverItem && !localItem) {
      mergedItems.push(JSON.parse(JSON.stringify(serverItem)));
      continue;
    }

    // 2. Added only in local
    if (!baseItem && !serverItem && localItem) {
      mergedItems.push(JSON.parse(JSON.stringify(localItem)));
      continue;
    }

    // 3. Deleted in local
    if (baseItem && serverItem && !localItem) {
      if (!isDeepEqual(serverItem, baseItem)) {
        conflicts.push({
          field: 'item.deleted',
          path: `chapters.${chapterId}.items.${itemId}`,
          label: `حذف الدرس: ${baseItem.title}`,
          baseValue: baseItem.title,
          serverValue: serverItem.title,
          localValue: '[تم حذفه محلياً]',
        });
        mergedItems.push(JSON.parse(JSON.stringify(serverItem)));
      }
      continue;
    }

    // 4. Deleted in server
    if (baseItem && !serverItem && localItem) {
      if (!isDeepEqual(localItem, baseItem)) {
        conflicts.push({
          field: 'item.deleted',
          path: `chapters.${chapterId}.items.${itemId}`,
          label: `حذف الدرس: ${baseItem.title}`,
          baseValue: baseItem.title,
          serverValue: '[تم حذفه على الخادم]',
          localValue: localItem.title,
        });
        mergedItems.push(JSON.parse(JSON.stringify(localItem)));
      }
      continue;
    }

    // 5. Exists in both server and local
    if (serverItem && localItem) {
      const mergedItem: ChapterItem = JSON.parse(JSON.stringify(localItem));
      const itemKeys: (keyof ChapterItem)[] = [
        'title',
        'type',
        'url',
        'duration',
        'canDownload',
        'downloadPolicy',
        'videoSourceType',
        'externalUrl',
        'mediaId',
        'completionPolicy',
        'embedPolicy',
      ];

      for (const k of itemKeys) {
        const bVal = baseItem ? baseItem[k] : undefined;
        const sVal = serverItem[k];
        const lVal = localItem[k];

        const sChanged = !isDeepEqual(sVal, bVal);
        const lChanged = !isDeepEqual(lVal, bVal);

        if (lChanged && !sChanged) {
          Reflect.set(mergedItem, k, lVal);
        } else if (sChanged && !lChanged) {
          Reflect.set(mergedItem, k, sVal);
        } else if (lChanged && sChanged) {
          if (isDeepEqual(lVal, sVal)) {
            Reflect.set(mergedItem, k, lVal);
          } else {
            conflicts.push({
              field: `item.${k}`,
              path: `chapters.${chapterId}.items.${itemId}.${k}`,
              label: `الدرس "${localItem.title || serverItem.title}": ${
                k === 'title' ? 'العنوان' : k === 'duration' ? 'المدة' : k
              }`,
              baseValue: bVal,
              serverValue: sVal,
              localValue: lVal,
            });
            Reflect.set(mergedItem, k, lVal);
          }
        }
      }

      mergedItems.push(mergedItem);
    }
  }

  return mergedItems;
}
