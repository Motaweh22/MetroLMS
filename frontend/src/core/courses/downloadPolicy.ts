import type { Course, ChapterItem } from './types';

export interface DownloadPermissionResult {
  allowed: boolean;
  reasonAr?: string;
}

/**
 * Evaluates whether an individual content item is eligible for download
 * based on its configured download policy, trainee enrollment, and progress.
 */
export function canDownloadItem(
  item: ChapterItem,
  isItemCompleted: boolean,
  isCourseCompleted: boolean,
  isEnrolled: boolean,
  userRole?: string
): DownloadPermissionResult {
  // External video links (YouTube / Google Drive) cannot be downloaded as LMS-owned files
  if (item.type === 'video' && (item.videoSourceType === 'youtube' || item.videoSourceType === 'drive')) {
    return {
      allowed: false,
      reasonAr: 'روابط الفيديو الخارجية (YouTube / Google Drive) غير متاحة للتنزيل كملفات مباشرة من المنصة',
    };
  }

  // Instructors and Admins have full preview & administrative download privileges
  if (userRole === 'admin' || userRole === 'lecturer') {
    return { allowed: true };
  }

  // Trainees must be actively enrolled
  if (!isEnrolled) {
    return { allowed: false, reasonAr: 'يجب التسجيل في الدورة التدريبية أولاً لتنزيل هذا المحتوى' };
  }

  // Determine policy: default to 'never' if explicitly marked not downloadable
  const policy = item.downloadPolicy || (item.canDownload ? 'immediate' : 'never');

  if (policy === 'never') {
    return { allowed: false, reasonAr: 'غير مصرح بتنزيل هذا الملف بقرار من المحاضر' };
  }

  if (policy === 'after_item_completion' && !isItemCompleted && !isCourseCompleted) {
    return { allowed: false, reasonAr: 'متاح للتنزيل فور إتمام متطلبات هذا الدرس' };
  }

  if (policy === 'after_course_completion' && !isCourseCompleted) {
    return { allowed: false, reasonAr: 'متاح للتنزيل بعد إتمام متطلبات الدورة التدريبية بالكامل' };
  }

  return { allowed: true };
}

/**
 * Evaluates whether the complete whole-course ZIP archive download is enabled
 * and accessible to the user based on course settings and progress.
 */
export function canDownloadCourseZip(
  course: Course,
  isCourseCompleted: boolean,
  isEnrolled: boolean,
  userRole?: string
): DownloadPermissionResult {
  // Instructors and Admins have full access
  if (userRole === 'admin' || userRole === 'lecturer') {
    return { allowed: true };
  }

  if (!isEnrolled) {
    return { allowed: false, reasonAr: 'يجب التسجيل في الدورة لتنزيل حقيبة الدورة المجمعة' };
  }

  const policy = course.courseZipPolicy || 'disabled';

  if (policy === 'disabled') {
    return { allowed: false, reasonAr: 'تنزيل الأرشيف المجمع للدورة غير مفعل لهذا البرنامج التدريبي' };
  }

  if (policy === 'after_course_completion' && !isCourseCompleted) {
    return { allowed: false, reasonAr: 'الأرشيف المجمع متاح فقط بعد إتمام الدورة التدريبية بنسبة 100%' };
  }

  return { allowed: true };
}

/**
 * Filters all items within a course that are eligible to be bundled into the ZIP archive.
 * Items configured as 'never' downloadable (e.g. protected video lectures) are strictly excluded.
 */
export function getEligibleZipItems(
  course: Course,
  isCourseCompleted: boolean,
  completedItemIds: string[],
  isEnrolled: boolean,
  userRole?: string
): { chapterTitle: string; item: ChapterItem }[] {
  const eligible: { chapterTitle: string; item: ChapterItem }[] = [];

  for (const chapter of course.chapters) {
    for (const item of chapter.items) {
      const isItemCompleted = completedItemIds.includes(item.id);
      const perm = canDownloadItem(item, isItemCompleted, isCourseCompleted, isEnrolled, userRole);
      if (perm.allowed) {
        eligible.push({ chapterTitle: chapter.title, item });
      }
    }
  }

  return eligible;
}
