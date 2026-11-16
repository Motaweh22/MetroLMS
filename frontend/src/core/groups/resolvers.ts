/**
 * MetroLMS — Centralized Training Groups Domain Resolvers
 *
 * Implements pure domain resolvers for Group Classification (D-GRP-03, D-GRP-06),
 * Operational Time Status, and Structured Time Information (D-GRP-02).
 */

import type {
  TrainingGroup,
  GroupRenewalCycle,
  GroupType,
  GroupStatus,
  CourseRole,
} from './types';
import type { GroupTimeInfo } from './dtos';

/**
 * Deterministically resolves whether a group is classified as 'regular' or 'reminder'.
 *
 * Enforces Decision D-GRP-03 and D-GRP-06 (Level 1 Authority):
 * 1. Monotonic Historical Marker: If `hasHistoricalReminderCourses === true`, the group
 *    permanently remains 'reminder' across its lifecycle. Removing current reminder courses
 *    never downgrades it to 'regular'.
 * 2. Active/Selected Cycle: If any assigned course has `courseRole === 'reminder'`.
 * 3. Group Baseline: If any group-level assigned course has `courseRole === 'reminder'`.
 * 4. Historical Cycles: If any historical cycle in `group.cycles` contains a reminder course.
 * 5. Fallback: Returns 'regular' only if no reminder assignment ever existed in its lifecycle.
 */
export function resolveGroupType(
  group: TrainingGroup,
  cycle?: GroupRenewalCycle | null
): GroupType {
  // 1. Monotonic historical marker (D-GRP-06)
  if (group.hasHistoricalReminderCourses === true) {
    return 'reminder';
  }

  // 2. Current/selected cycle course assignments
  if (cycle && Array.isArray(cycle.courses) && cycle.courses.length > 0) {
    if (cycle.courses.some((c) => c.courseRole === 'reminder')) {
      return 'reminder';
    }
  }

  // 3. Group baseline course assignments
  if (Array.isArray(group.courses) && group.courses.length > 0) {
    if (group.courses.some((c) => (c as { courseRole?: CourseRole }).courseRole === 'reminder')) {
      return 'reminder';
    }
  }

  // 4. Historical renewal cycles
  if (Array.isArray(group.cycles) && group.cycles.length > 0) {
    for (const historicalCycle of group.cycles) {
      if (
        Array.isArray(historicalCycle.courses) &&
        historicalCycle.courses.some((c) => c.courseRole === 'reminder')
      ) {
        return 'reminder';
      }
    }
  }

  // 5. Default regular
  return 'regular';
}

/**
 * Deterministically resolves the operational time status of a group ('active' | 'scheduled' | 'expired').
 *
 * Precedence Rules:
 * 1. Cycle dates take precedence over group baseline dates when an active cycle exists.
 * 2. If now < startDate -> 'scheduled'.
 * 3. If now > deadlineDate -> 'expired'.
 * 4. Invariant: An expired reminder group whose cycle deadline has passed is 'expired',
 *    even if a future nextScheduledRenewalDate is configured.
 */
export function resolveGroupOperationalStatus(
  group: TrainingGroup,
  cycle?: GroupRenewalCycle | null,
  now: Date | string = new Date()
): GroupStatus {
  const startIso = cycle?.startDateTime || group.startDateTime;
  const deadlineIso = cycle?.deadlineDateTime || group.deadlineDateTime;

  if (!startIso || !deadlineIso) {
    return 'active';
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  const startDate = new Date(startIso);
  const deadlineDate = new Date(deadlineIso);

  const nowMs = isNaN(nowDate.getTime()) ? Date.now() : nowDate.getTime();
  const startMs = startDate.getTime();
  const deadlineMs = deadlineDate.getTime();

  if (nowMs < startMs) {
    return 'scheduled';
  }
  if (nowMs > deadlineMs) {
    return 'expired';
  }
  return 'active';
}

/**
 * Calculates structured semantic time information for API contracts and domain logic.
 *
 * Adheres strictly to:
 * - Semantic situation tagging.
 * - Explicit nulls for unavailable dates (never fabricates dates).
 * - Day-based relative time calculations.
 * - Zero localized UI strings (presentation localization is handled in Phase D).
 */
export function calculateGroupTimeInfo(
  group: TrainingGroup,
  cycle?: GroupRenewalCycle | null,
  now: Date | string = new Date()
): GroupTimeInfo {
  const groupType = resolveGroupType(group, cycle);
  const operationalStatus = resolveGroupOperationalStatus(group, cycle, now);

  const nowDate = now instanceof Date ? now : new Date(now);
  const safeNowMs = isNaN(nowDate.getTime()) ? Date.now() : nowDate.getTime();

  // Primary date: start date for scheduled, deadline date for active or expired
  let primaryTargetDate: string | null = null;
  if (operationalStatus === 'scheduled') {
    primaryTargetDate = cycle?.startDateTime || group.startDateTime || null;
  } else {
    primaryTargetDate = cycle?.deadlineDateTime || group.deadlineDateTime || null;
  }

  // Secondary date: next scheduled renewal date for reminder programs if configured
  let secondaryDate: string | null = null;
  if (
    groupType === 'reminder' &&
    group.renewalSchedule?.nextScheduledRenewalDate
  ) {
    secondaryDate = group.renewalSchedule.nextScheduledRenewalDate;
  }

  let daysRemaining: number | null = null;
  let hoursRemaining: number | null = null;
  let daysPassed: number | null = null;
  let isOverdue = false;

  if (primaryTargetDate) {
    const targetDate = new Date(primaryTargetDate);
    if (!isNaN(targetDate.getTime())) {
      const diffMs = targetDate.getTime() - safeNowMs;
      if (diffMs >= 0) {
        daysRemaining = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        hoursRemaining = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        daysPassed = 0;
        isOverdue = false;
      } else {
        const passedMs = Math.abs(diffMs);
        daysPassed = Math.floor(passedMs / (24 * 60 * 60 * 1000));
        daysRemaining = 0;
        hoursRemaining = 0;
        isOverdue = operationalStatus === 'expired';
      }
    }
  }

  // Determine semantic situation
  let situation: GroupTimeInfo['situation'];
  if (operationalStatus === 'active') {
    situation = groupType === 'reminder' ? 'active_reminder' : 'active_regular';
  } else if (operationalStatus === 'scheduled') {
    situation = groupType === 'reminder' ? 'scheduled_reminder' : 'scheduled_regular';
  } else {
    // operationalStatus === 'expired'
    if (groupType === 'reminder') {
      situation = secondaryDate
        ? 'expired_reminder_with_next'
        : 'expired_reminder_without_next';
    } else {
      situation = 'expired_regular';
    }
  }

  return {
    situation,
    primaryTargetDate,
    secondaryDate,
    daysRemaining,
    hoursRemaining,
    daysPassed,
    isOverdue,
  };
}

/**
 * Deterministically sorts trainee groups for the persistent carousel:
 * 1. Active groups first, ordered by nearest applicable deadline ascending.
 * 2. Scheduled groups next, ordered by scheduled start date ascending.
 * 3. Expired groups last, ordered by most recently expired first (descending deadline date).
 *
 * Deterministic tie-breaker for equal dates:
 * - Arabic group name (`a.name.localeCompare(b.name, 'ar')`)
 * - Then group ID (`a.id.localeCompare(b.id)`)
 */
export function sortTraineeGroupsForCarousel<T extends {
  id: string;
  name: string;
  operationalStatus: GroupStatus;
  timeInfo: GroupTimeInfo;
  deadlineDateTime?: string | null;
  startDateTime?: string | null;
}>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    // 1. Status bucket: active (0), scheduled (1), expired (2)
    const statusOrder: Record<GroupStatus, number> = {
      active: 0,
      scheduled: 1,
      expired: 2,
    };

    const orderA = statusOrder[a.operationalStatus] ?? 3;
    const orderB = statusOrder[b.operationalStatus] ?? 3;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 2. Intra-status date comparison
    if (a.operationalStatus === 'active') {
      // Nearest deadline ascending
      const dateA = a.timeInfo.primaryTargetDate || a.deadlineDateTime;
      const dateB = b.timeInfo.primaryTargetDate || b.deadlineDateTime;
      if (dateA && dateB) {
        const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
        if (diff !== 0) return diff;
      } else if (dateA && !dateB) {
        return -1;
      } else if (!dateA && dateB) {
        return 1;
      }
    } else if (a.operationalStatus === 'scheduled') {
      // Nearest start date ascending
      const dateA = a.timeInfo.primaryTargetDate || a.startDateTime;
      const dateB = b.timeInfo.primaryTargetDate || b.startDateTime;
      if (dateA && dateB) {
        const diff = new Date(dateA).getTime() - new Date(dateB).getTime();
        if (diff !== 0) return diff;
      } else if (dateA && !dateB) {
        return -1;
      } else if (!dateA && dateB) {
        return 1;
      }
    } else if (a.operationalStatus === 'expired') {
      // Most recently expired first (descending deadline date)
      const dateA = a.deadlineDateTime || a.timeInfo.primaryTargetDate;
      const dateB = b.deadlineDateTime || b.timeInfo.primaryTargetDate;
      if (dateA && dateB) {
        const diff = new Date(dateB).getTime() - new Date(dateA).getTime();
        if (diff !== 0) return diff;
      } else if (dateA && !dateB) {
        return -1;
      } else if (!dateA && dateB) {
        return 1;
      }
    }

    // 3. Deterministic tie-breaker
    const nameDiff = a.name.localeCompare(b.name, 'ar');
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Formats structured GroupTimeInfo into human-readable Arabic presentation text.
 * Strictly adheres to presentation conventions without fabricating dates.
 */
export function formatGroupTimeInfoAr(timeInfo: GroupTimeInfo | undefined | null, now: Date | string = new Date()): string {
  if (!timeInfo || !timeInfo.situation) {
    return 'متاح';
  }
  const { situation, daysRemaining, hoursRemaining, daysPassed, secondaryDate, primaryTargetDate } = timeInfo;

  if (situation === 'active_regular' || situation === 'active_reminder') {
    if (daysRemaining !== null) {
      if (daysRemaining > 10) return `متبقي ${daysRemaining} يومًا على انتهاء المهلة`;
      if (daysRemaining > 2) return `متبقي ${daysRemaining} أيام على انتهاء المهلة`;
      if (daysRemaining === 2) return 'متبقي يومان على انتهاء المهلة';
      if (daysRemaining === 1) return 'متبقي يوم واحد على انتهاء المهلة';
      if (daysRemaining === 0) {
        if (hoursRemaining !== null && hoursRemaining > 0) {
          if (hoursRemaining > 10) return `متبقي ${hoursRemaining} ساعة على انتهاء المهلة`;
          if (hoursRemaining > 2) return `متبقي ${hoursRemaining} ساعات على انتهاء المهلة`;
          if (hoursRemaining === 2) return 'متبقي ساعتان على انتهاء المهلة';
          if (hoursRemaining === 1) return 'متبقي ساعة واحدة على انتهاء المهلة';
        }
        return 'تنتهي المهلة اليوم';
      }
    }
    return primaryTargetDate ? 'قيد التدريب' : 'قيد التدريب — غير محددة المهلة';
  }

  if (situation === 'scheduled_regular' || situation === 'scheduled_reminder') {
    if (daysRemaining !== null) {
      if (daysRemaining > 10) return `تبدأ بعد ${daysRemaining} يومًا`;
      if (daysRemaining > 2) return `تبدأ بعد ${daysRemaining} أيام`;
      if (daysRemaining === 2) return 'تبدأ بعد يومين';
      if (daysRemaining === 1) return 'تبدأ غداً';
      if (daysRemaining === 0) {
        if (hoursRemaining !== null && hoursRemaining > 0) {
          return `تبدأ بعد ${hoursRemaining} ساعة`;
        }
        return 'تبدأ اليوم';
      }
    }
    return 'مجدولة للمستقبل';
  }

  if (situation === 'expired_reminder_with_next') {
    if (secondaryDate) {
      const nowDate = now instanceof Date ? now : new Date(now);
      const secDate = new Date(secondaryDate);
      if (!isNaN(secDate.getTime()) && !isNaN(nowDate.getTime())) {
        const diffMs = secDate.getTime() - nowDate.getTime();
        const daysToNext = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        if (daysToNext > 10) return `انتهت الدورة — التذكير القادم بعد ${daysToNext} يومًا`;
        if (daysToNext > 2) return `انتهت الدورة — التذكير القادم بعد ${daysToNext} أيام`;
        if (daysToNext === 2) return 'انتهت الدورة — التذكير القادم بعد يومين';
        if (daysToNext === 1) return 'انتهت الدورة — التذكير القادم غداً';
        if (daysToNext <= 0) return 'انتهت الدورة — موعد دورة التذكير حان';
      }
    }
    return 'انتهت الدورة — محدد موعد للتذكير القادم';
  }

  if (situation === 'expired_reminder_without_next') {
    return 'انتهت الدورة — لم يتم تحديد موعد التذكير القادم';
  }

  // expired_regular or fallback
  if (daysPassed !== null && daysPassed > 0) {
    if (daysPassed > 10) return `انتهت الصلاحية منذ ${daysPassed} يومًا`;
    if (daysPassed > 2) return `انتهت الصلاحية منذ ${daysPassed} أيام`;
    if (daysPassed === 2) return 'انتهت الصلاحية منذ يومين';
    if (daysPassed === 1) return 'انتهت الصلاحية منذ يوم واحد';
  }
  return 'منتهية الصلاحية';
}


