"""Multi-source Enrollment, D-06 Attempt Isolation, D-07 Group Removal & D-12 Progress Services."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.courses.models import Course, LessonItem, PublishedCourseVersion
from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import GroupRenewalCycle, TrainingGroup
from apps.identity.models import User
from apps.learning.models import CourseAttempt, Enrollment, EnrollmentSourceGrant, LessonProgress


class LearningDomainError(Exception):
    """Domain validation, access, or state conflict error in apps.learning."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def compute_course_progress(attempt: CourseAttempt) -> dict:
    """Compute D-12 integer rounded progress with strict 100% gate (never persisted, OD-PF-02)."""
    lesson_ids = list(
        LessonItem.objects.filter(module__published_version_id=attempt.published_version_id).values_list("id", flat=True)
    )
    total = len(lesson_ids)
    completed_ids = []
    items_progress = {}
    if total == 0:
        completed = 0
        percent = 0
    else:
        rows = list(
            LessonProgress.objects.filter(
                course_attempt=attempt,
                lesson_item_id__in=lesson_ids,
            )
        )
        for r in rows:
            key = str(r.lesson_item_id)
            if r.is_completed:
                completed_ids.append(key)
            items_progress[key] = {
                "itemId": key,
                "completed": r.is_completed,
                "lastPositionSeconds": r.last_position_seconds,
                "furthestWatchedSeconds": r.furthest_watched_seconds,
                "eligibleViewingSeconds": r.eligible_viewing_seconds,
                "updatedAt": attempt.started_at.isoformat() if hasattr(attempt, "started_at") and attempt.started_at else "",
            }
        completed = len(completed_ids)
        if completed >= total:
            completed = total
            percent = 100
        else:
            # Half-up integer rounding matching Math.round((completed / total) * 100), capped at 99
            percent = min(99, (completed * 100 + total // 2) // total)

    return {
        "attemptId": attempt.id,
        "publishedVersionId": attempt.published_version_id,
        "groupRenewalCycleId": attempt.group_renewal_cycle_id,
        "isSealed": attempt.is_sealed,
        "completedLessons": completed,
        "totalLessons": total,
        "progressPercent": percent,
        "completedItemIds": completed_ids,
        "itemsProgress": items_progress,
    }


@transaction.atomic
def enroll_user_in_course(
    *,
    actor: User,
    user: User,
    course: Course,
    source_type: str = "direct",
    training_group: TrainingGroup | None = None,
    group_renewal_cycle: GroupRenewalCycle | None = None,
) -> tuple[Enrollment, EnrollmentSourceGrant, CourseAttempt]:
    """Create or extend multi-source Enrollment + SourceGrant + active CourseAttempt."""
    if source_type not in {"direct", "group", "self:continued"}:
        raise LearningDomainError("INVALID_SOURCE_TYPE", "مصدر التسجيل غير صالح.")
    if source_type == "group" and training_group is None:
        raise LearningDomainError("GROUP_REQUIRED", "يجب تحديد المجموعة التدريبية لمصدر التسجيل الجماعي.")
    if source_type != "group" and training_group is not None:
        raise LearningDomainError("UNEXPECTED_GROUP", "المجموعة التدريبية مسموحة فقط مع مصدر group.")

    latest_pub = (
        PublishedCourseVersion.objects.filter(course=course).order_by("-version_number").first()
    )
    if latest_pub is None:
        raise LearningDomainError(
            "COURSE_NOT_PUBLISHED",
            "لا يمكن التسجيل في دورة غير منشورة.",
            409,
        )

    now = timezone.now()
    enrollment = Enrollment.objects.select_for_update().filter(user=user, course=course).first()
    if enrollment is None:
        enrollment = Enrollment.objects.create(user=user, course=course, enrolled_at=now)

    grant, _ = EnrollmentSourceGrant.objects.get_or_create(
        enrollment=enrollment,
        source_type=source_type,
        training_group=training_group,
    )

    attempt = (
        CourseAttempt.objects.select_for_update()
        .filter(enrollment=enrollment, is_sealed=False, group_renewal_cycle=group_renewal_cycle)
        .order_by("-id")
        .first()
    )
    if attempt is None:
        attempt = CourseAttempt.objects.create(
            enrollment=enrollment,
            published_version=latest_pub,
            group_renewal_cycle=group_renewal_cycle,
            is_sealed=False,
        )

    record_audit_log(
        action="learning.enrolled",
        actor=actor,
        target_entity_type="Enrollment",
        target_entity_id=str(enrollment.id),
        details_snapshot={
            "userId": user.id,
            "courseId": course.id,
            "sourceType": source_type,
            "trainingGroupId": training_group.id if training_group else None,
        },
    )
    return enrollment, grant, attempt


@transaction.atomic
def revoke_group_enrollment_grant(
    *,
    actor: User | None,
    user: User,
    course: Course,
    training_group: TrainingGroup,
    convert_to_self_continued: bool = False,
) -> dict:
    """D-07: Remove group grant (optionally convert to self:continued) while preserving all progress."""
    enrollment = Enrollment.objects.select_for_update().filter(user=user, course=course).first()
    if enrollment is None:
        raise LearningDomainError("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", 404)

    EnrollmentSourceGrant.objects.filter(
        enrollment=enrollment,
        source_type="group",
        training_group=training_group,
    ).delete()

    if convert_to_self_continued:
        EnrollmentSourceGrant.objects.get_or_create(
            enrollment=enrollment,
            source_type="self:continued",
            training_group=None,
        )

    remaining = EnrollmentSourceGrant.objects.filter(enrollment=enrollment).count()
    record_audit_log(
        action="learning.group_grant_revoked",
        actor=actor,
        target_entity_type="Enrollment",
        target_entity_id=str(enrollment.id),
        details_snapshot={
            "trainingGroupId": training_group.id,
            "convertToSelfContinued": convert_to_self_continued,
            "remainingGrants": remaining,
        },
    )
    return {
        "enrollmentId": enrollment.id,
        "remainingGrants": remaining,
        "hasActiveAccess": remaining > 0,
    }


def get_active_attempt_for_user(
    *,
    user: User,
    course: Course,
    attempt_id: int | None = None,
) -> CourseAttempt:
    """Resolve user's active CourseAttempt while enforcing EnrollmentSourceGrant access (D-07)."""
    enrollment = Enrollment.objects.filter(user=user, course=course).first()
    if enrollment is None:
        raise LearningDomainError("NOT_ENROLLED", "المستخدم غير مسجل في هذه الدورة.", 404)

    if not EnrollmentSourceGrant.objects.filter(enrollment=enrollment).exists():
        raise LearningDomainError(
            "ACCESS_REVOKED",
            "تم إيقاف صلاحية الوصول لهذه الدورة مع الاحتفاظ بسجلك التعليمي.",
            403,
        )

    qs = CourseAttempt.objects.filter(enrollment=enrollment)
    if attempt_id is not None:
        attempt = qs.filter(pk=attempt_id).first()
    else:
        attempt = qs.filter(is_sealed=False).order_by("-id").first() or qs.order_by("-id").first()

    if attempt is None:
        raise LearningDomainError("ATTEMPT_NOT_FOUND", "لا توجد محاولة تعلم متاحة لهذه الدورة.", 404)
    return attempt


@transaction.atomic
def start_new_attempt(
    *,
    actor: User,
    user: User,
    course: Course,
    group_renewal_cycle: GroupRenewalCycle | None = None,
) -> CourseAttempt:
    """D-06: Seal prior unsealed attempt(s) and start a fresh isolated CourseAttempt."""
    enrollment = Enrollment.objects.select_for_update().filter(user=user, course=course).first()
    if enrollment is None:
        raise LearningDomainError("NOT_ENROLLED", "المستخدم غير مسجل في هذه الدورة.", 404)

    latest_pub = PublishedCourseVersion.objects.filter(course=course).order_by("-version_number").first()
    if latest_pub is None:
        raise LearningDomainError("COURSE_NOT_PUBLISHED", "لا توجد نسخة منشورة من هذه الدورة.", 409)

    CourseAttempt.objects.filter(enrollment=enrollment, is_sealed=False).update(is_sealed=True)
    attempt = CourseAttempt.objects.create(
        enrollment=enrollment,
        published_version=latest_pub,
        group_renewal_cycle=group_renewal_cycle,
        is_sealed=False,
    )
    record_audit_log(
        action="learning.attempt_started",
        actor=actor,
        target_entity_type="CourseAttempt",
        target_entity_id=str(attempt.id),
        details_snapshot={"enrollmentId": enrollment.id, "publishedVersionId": latest_pub.id},
    )
    return attempt


def _lock_attempt_and_lesson(
    *,
    user: User,
    course: Course,
    lesson_item_id: int,
) -> tuple[CourseAttempt, LessonItem]:
    enrollment = Enrollment.objects.filter(user=user, course=course).first()
    if enrollment is None:
        raise LearningDomainError("NOT_ENROLLED", "المستخدم غير مسجل في هذه الدورة.", 404)
    if not EnrollmentSourceGrant.objects.filter(enrollment=enrollment).exists():
        raise LearningDomainError("ACCESS_REVOKED", "تم إيقاف صلاحية الوصول لهذه الدورة.", 403)

    attempt = (
        CourseAttempt.objects.select_for_update()
        .filter(enrollment=enrollment, is_sealed=False)
        .order_by("-id")
        .first()
    )
    if attempt is None:
        raise LearningDomainError("ATTEMPT_SEALED", "لا توجد محاولة نشطة غير مختومة لهذه الدورة.", 409)

    lesson = LessonItem.objects.filter(
        pk=lesson_item_id,
        module__published_version_id=attempt.published_version_id,
    ).first()
    if lesson is None:
        raise LearningDomainError("LESSON_NOT_IN_ATTEMPT", "الدرس غير موجود في نسخة المحاولة الحالية.", 404)
    return attempt, lesson


@transaction.atomic
def record_lesson_activity(
    *,
    user: User,
    course: Course,
    lesson_item_id: int,
    last_position_seconds: int = 0,
    furthest_watched_seconds: int = 0,
    eligible_delta_seconds: int = 0,
    increment_watch_count: bool = False,
) -> tuple[LessonProgress, dict]:
    """Record playback telemetry on active CourseAttempt without inventing completion thresholds."""
    if min(last_position_seconds, furthest_watched_seconds, eligible_delta_seconds) < 0:
        raise LearningDomainError("INVALID_TELEMETRY", "قيم التقدم الزمني يجب أن تكون غير سالبة.")

    attempt, lesson = _lock_attempt_and_lesson(user=user, course=course, lesson_item_id=lesson_item_id)
    now = timezone.now()
    lp = (
        LessonProgress.objects.select_for_update()
        .filter(course_attempt=attempt, lesson_item=lesson)
        .first()
    )
    if lp is None:
        lp = LessonProgress.objects.create(
            course_attempt=attempt,
            lesson_item=lesson,
            is_completed=False,
            last_position_seconds=last_position_seconds,
            furthest_watched_seconds=max(last_position_seconds, furthest_watched_seconds),
            eligible_viewing_seconds=eligible_delta_seconds,
            watch_count=1 if increment_watch_count else 0,
            updated_at=now,
        )
    else:
        lp.last_position_seconds = last_position_seconds
        lp.furthest_watched_seconds = max(lp.furthest_watched_seconds, furthest_watched_seconds, last_position_seconds)
        lp.eligible_viewing_seconds += eligible_delta_seconds
        if increment_watch_count:
            lp.watch_count += 1
        lp.updated_at = now
        lp.save(
            update_fields=[
                "last_position_seconds",
                "furthest_watched_seconds",
                "eligible_viewing_seconds",
                "watch_count",
                "updated_at",
            ]
        )
    return lp, compute_course_progress(attempt)


@transaction.atomic
def mark_lesson_complete(
    *,
    user: User,
    course: Course,
    lesson_item_id: int,
) -> tuple[LessonProgress, dict]:
    """Explicitly mark a LessonItem completed inside the active CourseAttempt."""
    attempt, lesson = _lock_attempt_and_lesson(user=user, course=course, lesson_item_id=lesson_item_id)
    now = timezone.now()
    lp = (
        LessonProgress.objects.select_for_update()
        .filter(course_attempt=attempt, lesson_item=lesson)
        .first()
    )
    if lp is None:
        lp = LessonProgress.objects.create(
            course_attempt=attempt,
            lesson_item=lesson,
            is_completed=True,
            updated_at=now,
        )
    elif not lp.is_completed:
        lp.is_completed = True
        lp.updated_at = now
        lp.save(update_fields=["is_completed", "updated_at"])
    return lp, compute_course_progress(attempt)

