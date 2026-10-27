import type {
  TrainingGroup,
  GroupCourseAssignment,
  GroupCycleCourseAssignment,
  GroupRenewalCycle,
  GroupStatus,
  PostDeadlinePolicy,
  EffectiveCourseSettings,
  TraineeAttentionResult,
  CourseRole,
  CourseAttempt,
  TraineeCourseAttemptStats,
  MaterialFileType,
  GroupRenewalSchedule,
} from '@/core/groups/types';

/**
 * Validates a training date range (start date vs deadline).
 */
export interface DateRangeValidationResult {
  isValid: boolean;
  error?: string;
  durationMs?: number;
}

export function validateDateRange(
  startDateTime: string,
  deadlineDateTime: string,
  minDurationHours = 1
): DateRangeValidationResult {
  if (!startDateTime || !deadlineDateTime) {
    return {
      isValid: false,
      error: 'تاريخ البداية وتاريخ النهاية كلاهما مطلوب',
    };
  }

  const start = new Date(startDateTime);
  const deadline = new Date(deadlineDateTime);

  if (isNaN(start.getTime()) || isNaN(deadline.getTime())) {
    return {
      isValid: false,
      error: 'تنسيق التاريخ والوقت غير صالح',
    };
  }

  const durationMs = deadline.getTime() - start.getTime();
  const minDurationMs = minDurationHours * 3600 * 1000;

  if (durationMs <= 0) {
    return {
      isValid: false,
      error: 'يجب أن يكون تاريخ وموعد النهاية بعد تاريخ وموعد البداية',
      durationMs,
    };
  }

  if (durationMs < minDurationMs) {
    return {
      isValid: false,
      error: 'يجب أن تكون مدة التدريب ساعة واحدة على الأقل',
      durationMs,
    };
  }

  return {
    isValid: true,
    durationMs,
  };
}

/**
 * Calculates effective course settings considering three-level precedence:
 * Course override > Cycle date > Group default
 *
 * Backward-compatible: If `cycle` is omitted or null, resolves Course override > Group default.
 */
export function getEffectiveCourseSettings(
  group: TrainingGroup,
  courseAssignment: GroupCourseAssignment | GroupCycleCourseAssignment | string,
  currentDate?: Date,
  cycle?: GroupRenewalCycle | null
): EffectiveCourseSettings {
  let assignment: GroupCourseAssignment | GroupCycleCourseAssignment;
  if (typeof courseAssignment === 'string') {
    const cycleCourse = cycle?.courses?.find((c) => c.courseId === courseAssignment);
    const groupCourse = (group.courses || []).find((c) => c.courseId === courseAssignment);
    assignment = cycleCourse || groupCourse || {
      courseId: courseAssignment,
      order: 1,
    };
  } else {
    assignment = courseAssignment;
  }

  // Precedence: Course override > Cycle date > Group default
  let effectiveStartDateTime: string;
  let startInheritedFrom: 'course_override' | 'cycle' | 'group';
  if (assignment.customStartDateTime) {
    effectiveStartDateTime = assignment.customStartDateTime;
    startInheritedFrom = 'course_override';
  } else if (cycle?.startDateTime) {
    effectiveStartDateTime = cycle.startDateTime;
    startInheritedFrom = 'cycle';
  } else {
    effectiveStartDateTime = group.startDateTime;
    startInheritedFrom = 'group';
  }

  let effectiveDeadlineDateTime: string;
  let deadlineInheritedFrom: 'course_override' | 'cycle' | 'group';
  if (assignment.customDeadlineDateTime) {
    effectiveDeadlineDateTime = assignment.customDeadlineDateTime;
    deadlineInheritedFrom = 'course_override';
  } else if (cycle?.deadlineDateTime) {
    effectiveDeadlineDateTime = cycle.deadlineDateTime;
    deadlineInheritedFrom = 'cycle';
  } else {
    effectiveDeadlineDateTime = group.deadlineDateTime;
    deadlineInheritedFrom = 'group';
  }

  let effectivePostDeadlinePolicy: PostDeadlinePolicy;
  let policyInheritedFrom: 'course_override' | 'cycle' | 'group';
  if (assignment.customPostDeadlinePolicy) {
    effectivePostDeadlinePolicy = assignment.customPostDeadlinePolicy;
    policyInheritedFrom = 'course_override';
  } else if (cycle?.postDeadlinePolicy) {
    effectivePostDeadlinePolicy = cycle.postDeadlinePolicy;
    policyInheritedFrom = 'cycle';
  } else {
    effectivePostDeadlinePolicy = group.postDeadlinePolicy || 'keep_no_cert';
    policyInheritedFrom = 'group';
  }

  const hasStartOverride = Boolean(assignment.customStartDateTime);
  const hasDeadlineOverride = Boolean(assignment.customDeadlineDateTime);
  const hasPolicyOverride = Boolean(assignment.customPostDeadlinePolicy);
  const hasAnyOverride = hasStartOverride || hasDeadlineOverride || hasPolicyOverride;

  const dateValidation = validateDateRange(effectiveStartDateTime, effectiveDeadlineDateTime);

  const now = currentDate ? new Date(currentDate) : new Date();
  const start = new Date(effectiveStartDateTime);
  const deadline = new Date(effectiveDeadlineDateTime);

  let status: GroupStatus = 'active';
  if (now.getTime() < start.getTime()) {
    status = 'scheduled';
  } else if (now.getTime() > deadline.getTime()) {
    status = 'expired';
  }

  const statusLabels: Record<GroupStatus, string> = {
    active: 'نشطة',
    scheduled: 'مجدولة',
    expired: 'منتهية',
  };

  const badgeVariants: Record<GroupStatus, 'primary' | 'warning' | 'neutral' | 'danger'> = {
    active: 'primary',
    scheduled: 'neutral',
    expired: 'danger',
  };

  const courseRole = 'courseRole' in assignment ? assignment.courseRole : undefined;

  return {
    courseId: assignment.courseId,
    startDateTime: effectiveStartDateTime,
    deadlineDateTime: effectiveDeadlineDateTime,
    effectiveStartDateTime,
    effectiveDeadlineDateTime,
    postDeadlinePolicy: effectivePostDeadlinePolicy,
    effectivePostDeadlinePolicy,
    hasStartOverride,
    hasDeadlineOverride,
    hasPolicyOverride,
    hasAnyOverride,
    status,
    statusInfo: {
      key: status,
      label: statusLabels[status] || status,
      badgeVariant: badgeVariants[status] || 'neutral',
    },
    isExpired: status === 'expired',
    isScheduled: status === 'scheduled',
    isActive: status === 'active',
    cycleId: cycle?.id ?? null,
    courseRole,
    inheritedFrom: {
      start: startInheritedFrom,
      deadline: deadlineInheritedFrom,
      policy: policyInheritedFrom,
    },
    isValidDateRange: dateValidation.isValid,
    dateRangeError: dateValidation.error,
  };
}

/**
 * Validates course assignments within a renewal cycle.
 * Ensures uniqueness of courses and that no course is assigned conflicting roles (core vs reminder).
 */
export interface CycleCourseValidationResult {
  isValid: boolean;
  error?: string;
  duplicates?: string[];
  coreCoursesCount: number;
  reminderCoursesCount: number;
}

export function validateCycleCourseAssignments(
  assignments: GroupCycleCourseAssignment[]
): CycleCourseValidationResult {
  if (!assignments || assignments.length === 0) {
    return {
      isValid: false,
      error: 'يجب تعيين مقرر تدريبي واحد على الأقل في دورة التجديد',
      coreCoursesCount: 0,
      reminderCoursesCount: 0,
    };
  }

  const seenIds = new Set<string>();
  const duplicates: string[] = [];
  let coreCount = 0;
  let reminderCount = 0;

  for (const a of assignments) {
    const normalized = a.courseId.trim().toLowerCase();
    if (seenIds.has(normalized)) {
      if (!duplicates.includes(a.courseId)) {
        duplicates.push(a.courseId);
      }
    } else {
      seenIds.add(normalized);
    }

    if (a.courseRole === 'core') {
      coreCount++;
    } else if (a.courseRole === 'reminder') {
      reminderCount++;
    }
  }

  if (duplicates.length > 0) {
    return {
      isValid: false,
      error: `لا يمكن تعيين المقرر التدريبي (${duplicates.join(', ')}) أكثر من مرة أو دمجه كدورة أساسية وتنشيطية في نفس دورة التجديد`,
      duplicates,
      coreCoursesCount: coreCount,
      reminderCoursesCount: reminderCount,
    };
  }

  return {
    isValid: true,
    coreCoursesCount: coreCount,
    reminderCoursesCount: reminderCount,
  };
}

/**
 * Pure factory creating an unstarted CourseAttempt record.
 * Provisioning is not starting: attemptNumber is null and status is 'not_started'.
 */
export function createCourseAttempt(params: {
  id: string;
  userId: string;
  courseId: string;
  cycleId?: string | null;
  groupId?: string | null;
  courseRole?: CourseRole;
  createdAt?: string;
}): CourseAttempt {
  const now = params.createdAt || new Date().toISOString();
  return {
    id: params.id,
    userId: params.userId,
    courseId: params.courseId,
    cycleId: params.cycleId ?? null,
    groupId: params.groupId ?? null,
    attemptNumber: null, // Unassigned until the trainee actually starts learning!
    courseRole: params.courseRole,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    lastActivityAt: null,
    progressPercent: 0,
    completedItemIds: [],
    lastWatchedItemId: null,
    lessonProgress: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Checks whether an attempt has actively started.
 * Only attempts with active learning activity (progress, started timestamp, completed items) are started.
 */
export function isAttemptStarted(attempt: CourseAttempt): boolean {
  if (!attempt) return false;
  return Boolean(
    attempt.startedAt ||
      attempt.status === 'in_progress' ||
      attempt.status === 'completed' ||
      (attempt.attemptNumber !== null && attempt.attemptNumber > 0) ||
      attempt.completedItemIds.length > 0 ||
      attempt.progressPercent > 0
  );
}

/**
 * Checks whether an attempt has completed.
 */
export function isAttemptCompleted(attempt: CourseAttempt): boolean {
  if (!attempt) return false;
  return attempt.status === 'completed' || Boolean(attempt.completedAt);
}

/**
 * Starts a course attempt, assigning the next attemptNumber dynamically based on
 * previously started attempts for the trainee and course.
 *
 * Idempotent: If the attempt is already started, returns it unmodified.
 */
export function startCourseAttempt(
  attempt: CourseAttempt,
  existingAttemptsForCourse: CourseAttempt[],
  startedAt = new Date().toISOString()
): CourseAttempt {
  // If already started and has an assigned number, keep stable identity
  if (isAttemptStarted(attempt) && attempt.attemptNumber !== null) {
    return attempt;
  }

  const normalizedCourseId = attempt.courseId.trim().toLowerCase();
  const normalizedUserId = attempt.userId.trim().toLowerCase();

  // Find other started attempts for this user and course across all cycles/groups
  const otherStartedAttempts = existingAttemptsForCourse.filter((a) => {
    if (a.id === attempt.id) return false;
    const sameUser = a.userId.trim().toLowerCase() === normalizedUserId;
    const sameCourse = a.courseId.trim().toLowerCase() === normalizedCourseId;
    return sameUser && sameCourse && isAttemptStarted(a);
  });

  const maxExistingNumber = otherStartedAttempts.reduce((max, a) => {
    return Math.max(max, a.attemptNumber ?? 0);
  }, 0);

  const nextAttemptNumber = maxExistingNumber + 1;

  return {
    ...attempt,
    attemptNumber: nextAttemptNumber,
    status: attempt.status === 'not_started' ? 'in_progress' : attempt.status,
    startedAt: attempt.startedAt || startedAt,
    lastActivityAt: startedAt,
    updatedAt: startedAt,
  };
}

/**
 * Pure calculation of course attempt statistics for a trainee and course.
 *
 * Rules:
 * - Attempts are tracked at the course level across renewal cycles.
 * - Deduplicates attempts sharing the same (userId, courseId, cycleId) to prevent
 *   multiple group assignments from inflating counts.
 * - Provisioned/unstarted attempts do not increment started count.
 * - Only completed attempts contribute to previous completions count.
 */
export function calculateCourseAttemptStats(options: {
  attempts: CourseAttempt[];
  userId: string;
  courseId: string;
  currentCycleId?: string | null;
  currentAttemptId?: string | null;
}): TraineeCourseAttemptStats {
  const { attempts, userId, courseId, currentCycleId, currentAttemptId } = options;

  const normalizedUserId = userId.trim().toLowerCase();
  const normalizedCourseId = courseId.trim().toLowerCase();

  // Filter attempts belonging strictly to this user and course
  const userCourseAttempts = attempts.filter(
    (a) =>
      a.userId.trim().toLowerCase() === normalizedUserId &&
      a.courseId.trim().toLowerCase() === normalizedCourseId
  );

  // Deduplicate attempts by cycleId so duplicate group memberships or multiple assignments
  // in the same cycle do NOT independently inflate attempt counts
  const seenCycleKeys = new Map<string, CourseAttempt>();
  for (const att of userCourseAttempts) {
    const cycleKey = att.cycleId || `standalone_${att.id}`;
    if (!seenCycleKeys.has(cycleKey)) {
      seenCycleKeys.set(cycleKey, att);
    } else {
      // If one is started and the duplicate is not started, keep the started one
      const existing = seenCycleKeys.get(cycleKey)!;
      if (!isAttemptStarted(existing) && isAttemptStarted(att)) {
        seenCycleKeys.set(cycleKey, att);
      }
    }
  }

  const uniqueAttempts = Array.from(seenCycleKeys.values());

  // Identify current attempt
  let currentAttempt: CourseAttempt | null = null;
  if (currentAttemptId) {
    currentAttempt = uniqueAttempts.find((a) => a.id === currentAttemptId) || null;
  } else if (currentCycleId) {
    currentAttempt = uniqueAttempts.find((a) => a.cycleId === currentCycleId) || null;
  }

  // If still not identified, pick the newest attempt
  if (!currentAttempt && uniqueAttempts.length > 0) {
    currentAttempt = uniqueAttempts[uniqueAttempts.length - 1];
  }

  // Historical attempts are all other unique attempts
  const historicalAttempts = uniqueAttempts.filter(
    (a) => !currentAttempt || a.id !== currentAttempt.id
  );

  // Only attempts that have ACTUALLY STARTED contribute to previous started count
  const previousStartedAttemptsCount = historicalAttempts.filter(isAttemptStarted).length;

  // Only attempts that are COMPLETED contribute to completion count
  const previousCompletionsCount = historicalAttempts.filter(isAttemptCompleted).length;

  const hasStartedCurrent = currentAttempt ? isAttemptStarted(currentAttempt) : false;

  // Current attempt number: if assigned, use it; otherwise, projected next attempt number for display
  const currentAttemptNumber = currentAttempt?.attemptNumber ?? null;
  const displayAttemptNumber = currentAttemptNumber ?? previousStartedAttemptsCount + 1;

  return {
    courseId,
    currentAttemptNumber,
    displayAttemptNumber,
    previousStartedAttemptsCount,
    previousCompletionsCount,
    currentAttempt,
    hasStartedCurrentAttempt: hasStartedCurrent,
    historicalAttempts,
  };
}

/**
 * Formats a user-friendly attempt indicator badge in Arabic.
 */
export function formatAttemptBadge(stats: TraineeCourseAttemptStats): {
  title: string;
  badgeText: string;
  detailsText: string;
} {
  const num = stats.displayAttemptNumber;
  const ordinals: Record<number, string> = {
    1: 'الأولى',
    2: 'الثانية',
    3: 'الثالثة',
    4: 'الرابعة',
    5: 'الخامسة',
  };

  const attemptName = ordinals[num] || `رقم ${num}`;
  const title = `محاولتك ${attemptName} لهذا المقرر`;
  const badgeText = `محاولة ${num}`;

  let detailsText = '';
  if (stats.previousCompletionsCount > 0) {
    detailsText = `${stats.previousCompletionsCount} إكمال سابق ناجح`;
  } else if (stats.previousStartedAttemptsCount > 0) {
    detailsText = `${stats.previousStartedAttemptsCount} محاولة سابقة غير مكتملة`;
  } else {
    detailsText = 'المحاولة الأولى';
  }

  return {
    title,
    badgeText,
    detailsText,
  };
}

/**
 * Pure helper to resolve material file classification from file name and MIME type.
 */
export function resolveMaterialFileType(fileName: string, mimeType?: string): MaterialFileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf' || mimeType?.includes('pdf')) return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || mimeType?.startsWith('image/')) return 'image';
  if (['doc', 'docx'].includes(ext) || mimeType?.includes('word')) return 'word';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'excel';
  if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return 'powerpoint';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType?.includes('zip') || mimeType?.includes('compressed')) return 'archive';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext) || mimeType?.startsWith('video/')) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext) || mimeType?.startsWith('audio/')) return 'audio';

  return 'other';
}

/**
 * Pure helper to validate a file proposed for upload into group materials.
 */
export function validateMaterialUpload(
  file: { name: string; size: number },
  maxSizeBytes = 50 * 1024 * 1024
): { isValid: boolean; error?: string } {
  if (!file.name || file.name.trim().length === 0) {
    return { isValid: false, error: 'اسم الملف مطلوب' };
  }

  if (file.size <= 0) {
    return { isValid: false, error: 'الملف فارغ لا يحتوي على بيانات' };
  }

  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return { isValid: false, error: `حجم الملف يتجاوز الحد الأقصى المسموح به (${maxMb} ميجابايت)` };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = [
    'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'rar', '7z', 'txt',
    'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg',
  ];

  if (!allowedExtensions.includes(ext)) {
    return { isValid: false, error: `نوع الملف (.${ext}) غير مدعوم في حقيبة مواد التدريب` };
  }

  return { isValid: true };
}

/**
 * Checks whether a trainee's progress on an assigned course needs supervisor attention.
 */
export function checkTraineeAttention({
  progressPercent,
  isCompleted,
  notStarted,
  status,
  startDateTime,
  deadlineDateTime,
  now = new Date(),
}: {
  progressPercent: number;
  isCompleted: boolean;
  notStarted: boolean;
  status: GroupStatus;
  startDateTime: string;
  deadlineDateTime: string;
  now?: Date;
}): TraineeAttentionResult {
  const start = new Date(startDateTime);
  const deadline = new Date(deadlineDateTime);

  // If course/group is expired and trainee did not complete it
  if (status === 'expired') {
    if (!isCompleted) {
      return {
        needsAttention: true,
        reason: 'انتهى الموعد النهائي المحدد للكورس ولم يتم استكماله',
        badge: 'لم يكتمل بالموعد',
        level: 'danger',
      };
    }
    return { needsAttention: false, reason: '', badge: '', level: '' };
  }

  // Active group checks:
  const totalMs = Math.max(1, deadline.getTime() - start.getTime());
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const elapsedRatio = Math.min(1, elapsedMs / totalMs);

  if (notStarted && elapsedRatio >= 0.20) {
    return {
      needsAttention: true,
      reason: 'لم يبدأ بعد رغم مرور أكثر من 20% من مدة التدريب',
      badge: 'لم يبدأ بعد',
      level: 'warning',
    };
  }

  if (elapsedRatio >= 0.50 && progressPercent < 25) {
    return {
      needsAttention: true,
      reason: 'تأخر ملحوظ في الإنجاز مقارنة بالوقت المنقضي للتدريب',
      badge: 'متأخر في الإنجاز',
      level: 'warning',
    };
  }

  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 3600);
  if (hoursRemaining <= 48 && hoursRemaining > 0 && progressPercent < 60) {
    return {
      needsAttention: true,
      reason: 'اقتراب الموعد النهائي (أقل من 48 ساعة) مع عدم استكمال المحتوى',
      badge: 'موعد قريب',
      level: 'danger',
    };
  }

  return { needsAttention: false, reason: '', badge: '', level: '' };
}

/**
 * Formats user-friendly remaining time in Arabic
 */
export function formatRemainingTime(
  deadlineDateTime: string,
  startDateTime: string,
  status: GroupStatus,
  now = new Date()
): string {
  const start = new Date(startDateTime);
  const deadline = new Date(deadlineDateTime);

  if (status === 'scheduled') {
    const msUntilStart = start.getTime() - now.getTime();
    const days = Math.max(1, Math.ceil(msUntilStart / (1000 * 3600 * 24)));
    return `يبدأ بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
  }

  if (status === 'active') {
    const msUntilDeadline = deadline.getTime() - now.getTime();
    if (msUntilDeadline <= 0) return 'الموعد النهائي اليوم';
    const days = Math.floor(msUntilDeadline / (1000 * 3600 * 24));
    const hours = Math.floor((msUntilDeadline % (1000 * 3600 * 24)) / (1000 * 3600));
    return days > 0 ? `متبقي ${days} يوم و ${hours} س` : `متبقي ${hours} ساعة`;
  }

  const msPassed = now.getTime() - deadline.getTime();
  const days = Math.max(1, Math.floor(msPassed / (1000 * 3600 * 24)));
  return `انتهى منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
}

/**
 * Maximum sensible renewal interval in days (2 years = 730 days)
 */
export const MAX_RENEWAL_INTERVAL_DAYS = 730;

export interface RenewalIntervalValidationResult {
  isValid: boolean;
  error?: string;
  intervalDays?: number;
}

/**
 * Validates a renewal interval in days.
 * Must be a positive whole integer between 1 and 730.
 */
export function validateRenewalIntervalDays(val: unknown): RenewalIntervalValidationResult {
  if (
    val === undefined ||
    val === null ||
    val === '' ||
    (typeof val === 'string' && val.trim() === '')
  ) {
    return {
      isValid: false,
      error: 'يرجى إدخال عدد أيام فترة التجديد الدوري',
    };
  }

  const num = typeof val === 'number' ? val : Number(String(val).trim());

  if (isNaN(num) || !Number.isFinite(num) || !Number.isInteger(num)) {
    return {
      isValid: false,
      error: 'يجب أن تكون فترة التجديد رقماً صحيحاً من الأيام',
    };
  }

  if (num <= 0) {
    return {
      isValid: false,
      error: 'يجب أن تكون فترة التجديد يوماً واحداً على الأقل',
    };
  }

  if (num > MAX_RENEWAL_INTERVAL_DAYS) {
    return {
      isValid: false,
      error: `فترة التجديد لا يمكن أن تتجاوز ${MAX_RENEWAL_INTERVAL_DAYS} يوماً (سنتين)`,
    };
  }

  return {
    isValid: true,
    intervalDays: num,
  };
}

/**
 * Calculates the next scheduled cycle start date based on:
 * Next cycle start = Anchor cycle start + N calendar days
 *
 * Correctly handles calendar month and year transitions.
 *
 * @param anchorDate The anchor start date (ISO string or Date)
 * @param intervalDays Positive integer of calendar days
 * @returns ISO string of the calculated next renewal date
 */
export function calculateNextRenewalDate(anchorDate: string | Date, intervalDays: number): string {
  const validation = validateRenewalIntervalDays(intervalDays);
  if (!validation.isValid || !validation.intervalDays) {
    throw new Error(validation.error || 'عدد أيام فترة التجديد غير صالح');
  }

  const anchor = new Date(anchorDate);
  if (isNaN(anchor.getTime())) {
    throw new Error('تاريخ بداية الدورة المرجعي غير صالح');
  }

  const result = new Date(anchor);
  result.setUTCDate(result.getUTCDate() + validation.intervalDays);
  return result.toISOString();
}

/**
 * Safe version of calculateNextRenewalDate that returns null instead of throwing on invalid inputs.
 * Ideal for live UI previews.
 */
export function calculateNextRenewalDateSafe(
  anchorDate: string | Date | null | undefined,
  intervalDays: number | string | null | undefined
): string | null {
  if (!anchorDate || intervalDays === undefined || intervalDays === null || intervalDays === '') {
    return null;
  }

  const validation = validateRenewalIntervalDays(intervalDays);
  if (!validation.isValid || !validation.intervalDays) {
    return null;
  }

  const anchor = new Date(anchorDate);
  if (isNaN(anchor.getTime())) {
    return null;
  }

  const result = new Date(anchor);
  result.setUTCDate(result.getUTCDate() + validation.intervalDays);
  return result.toISOString();
}

/**
 * Backward compatibility migration helper:
 * Converts legacy recurrenceType values ('monthly', 'bimonthly', 'quarterly', 'none', 'custom')
 * into the standardized day-based renewal schedule contract.
 */
export function migrateLegacyRecurrenceType(
  schedule?: Partial<GroupRenewalSchedule> | null
): GroupRenewalSchedule {
  if (!schedule) {
    return {
      autoRenewalEnabled: false,
      intervalDays: null,
      renewalIntervalDays: null,
      nextScheduledRenewalDate: null,
      lastAutoRenewedCycleId: null,
      recurrenceType: 'none',
    };
  }

  let intervalDays: number | null = null;

  if (schedule.renewalIntervalDays !== undefined && schedule.renewalIntervalDays !== null) {
    intervalDays = Number(schedule.renewalIntervalDays);
  } else if (schedule.intervalDays !== undefined && schedule.intervalDays !== null) {
    intervalDays = Number(schedule.intervalDays);
  } else if (schedule.recurrenceType) {
    switch (schedule.recurrenceType) {
      case 'monthly':
        intervalDays = 30;
        break;
      case 'bimonthly':
        intervalDays = 60;
        break;
      case 'quarterly':
        intervalDays = 90;
        break;
      case 'none':
        intervalDays = null;
        break;
      case 'custom':
        intervalDays = null;
        break;
    }
  }

  const autoRenewalEnabled =
    schedule.autoRenewalEnabled !== undefined
      ? schedule.autoRenewalEnabled
      : schedule.recurrenceType !== 'none' && intervalDays !== null;

  // Infer or preserve recurrenceType
  let recurrenceType = schedule.recurrenceType;
  if (!recurrenceType) {
    if (!autoRenewalEnabled || intervalDays === null) {
      recurrenceType = 'none';
    } else if (intervalDays === 30) {
      recurrenceType = 'monthly';
    } else if (intervalDays === 60) {
      recurrenceType = 'bimonthly';
    } else if (intervalDays === 90) {
      recurrenceType = 'quarterly';
    } else {
      recurrenceType = 'custom';
    }
  }

  return {
    autoRenewalEnabled,
    intervalDays,
    renewalIntervalDays: intervalDays,
    nextScheduledRenewalDate: schedule.nextScheduledRenewalDate || null,
    lastAutoRenewedCycleId: schedule.lastAutoRenewedCycleId || null,
    recurrenceType,
  };
}


