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
    pub_lessons = list(
        LessonItem.objects.select_related("module")
        .filter(module__published_version_id=attempt.published_version_id)
        .order_by("module__sort_order", "sort_order", "id")
    )
    lesson_ids = [l.id for l in pub_lessons]
    total = len(lesson_ids)
    completed_ids: list[str] = []
    items_progress: dict[str, dict] = {}
    last_watched_item_id: str | None = None
    last_watched_lesson_title: str = ""

    if total == 0:
        completed = 0
        percent = 0
    else:
        # Map published LessonItem ID -> corresponding CourseDraft LessonItem ID (if draft exists)
        # because CourseSerializer serves CourseDraft lesson IDs when a draft is present on the course.
        pub_to_draft_id: dict[int, int] = {}
        course_id = getattr(attempt.published_version, "course_id", None)
        if course_id is None:
            course_id = (
                PublishedCourseVersion.objects.filter(pk=attempt.published_version_id)
                .values_list("course_id", flat=True)
                .first()
            )
        if course_id is not None:
            draft_lessons = list(
                LessonItem.objects.select_related("module")
                .filter(module__course_draft__course_id=course_id)
                .order_by("module__sort_order", "sort_order", "id")
            )
            if draft_lessons:
                by_pos = {(dl.module.sort_order, dl.sort_order): dl.id for dl in draft_lessons}
                by_title = {dl.title: dl.id for dl in draft_lessons}
                for pl in pub_lessons:
                    matched_draft_id = by_pos.get((pl.module.sort_order, pl.sort_order)) or by_title.get(pl.title)
                    if matched_draft_id is not None:
                        pub_to_draft_id[pl.id] = matched_draft_id

        pub_title_by_id = {pl.id: pl.title for pl in pub_lessons}
        rows = list(
            LessonProgress.objects.filter(
                course_attempt=attempt,
                lesson_item_id__in=lesson_ids,
            ).order_by("updated_at", "id")
        )
        completed_pub_count = 0
        for r in rows:
            pub_key = str(r.lesson_item_id)
            draft_id = pub_to_draft_id.get(r.lesson_item_id)
            draft_key = str(draft_id) if draft_id is not None else None
            if r.is_completed:
                completed_pub_count += 1
                completed_ids.append(pub_key)
                if draft_key and draft_key not in completed_ids:
                    completed_ids.append(draft_key)
            entry = {
                "itemId": pub_key,
                "completed": r.is_completed,
                "lastPositionSeconds": r.last_position_seconds,
                "furthestWatchedSeconds": r.furthest_watched_seconds,
                "eligibleViewingSeconds": r.eligible_viewing_seconds,
                "updatedAt": r.updated_at.isoformat() if r.updated_at else "",
            }
            items_progress[pub_key] = entry
            if draft_key and draft_key != pub_key:
                items_progress[draft_key] = {**entry, "itemId": draft_key}

            last_watched_item_id = draft_key or pub_key
            last_watched_lesson_title = pub_title_by_id.get(r.lesson_item_id, "")

        completed = completed_pub_count
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
        "percentage": percent,
        "completedItemIds": completed_ids,
        "itemsProgress": items_progress,
        "lastWatchedItemId": last_watched_item_id,
        "lastWatchedLessonTitle": last_watched_lesson_title,
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
    allow_privileged_source: bool = False,
) -> tuple[Enrollment, EnrollmentSourceGrant, CourseAttempt]:
    """Create or extend multi-source Enrollment + SourceGrant + active CourseAttempt."""
    if source_type not in {"direct", "group", "self:continued", "qr_code"}:
        raise LearningDomainError("INVALID_SOURCE_TYPE", "مصدر التسجيل غير صالح.")
    if (
        source_type in {"group", "qr_code"}
        and not allow_privileged_source
        and actor.id == user.id
        and actor.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}
    ):
        raise LearningDomainError(
            "PERMISSION_DENIED",
            "مصدر التسجيل يتطلب تصريحاً إدارياً أو رمزاً معتمداً.",
            403,
        )
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

    grant, grant_created = EnrollmentSourceGrant.objects.get_or_create(
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
    if grant_created and source_type == "direct" and actor.id != user.id:
        from apps.communications.services.communications_service import send_notification

        send_notification(
            user=user,
            title=f"تمت إضافتك إلى مقرر جديد: {course.title}",
            body=f"تم تسجيلك مباشرة في المقرر التدريبي «{course.title}». يمكنك البدء في استعراض المحتوى من قائمة مقرراتي.",
        )
    return enrollment, grant, attempt


@transaction.atomic
def reconcile_user_enrollments_on_org_change(*, actor: User, user: User) -> list[Course]:
    """Revoke non-group enrollments for targeted courses no longer matching user's org profile, and notify user."""
    from apps.communications.services.communications_service import send_notification
    from apps.courses.services.course_service import does_user_match_course_audience

    revoked_courses: list[Course] = []
    enrollments = (
        Enrollment.objects.filter(user=user, source_grants__isnull=False)
        .select_related("course")
        .distinct()
    )
    for enrollment in enrollments:
        course = enrollment.course
        if (getattr(course, "access_mode", "targeted") or "targeted") != "targeted":
            continue
        if does_user_match_course_audience(user, course):
            continue
        if enrollment.source_grants.filter(source_type="group").exists():
            continue

        deleted_count, _ = EnrollmentSourceGrant.objects.filter(enrollment=enrollment).exclude(
            source_type="group"
        ).delete()
        if deleted_count > 0:
            revoked_courses.append(course)
            send_notification(
                user=user,
                title=f"تم سحب صلاحية الوصول إلى مقرر: {course.title}",
                body=f"نظراً لتحديث بياناتك التنظيمية (الإدارة أو المسمى الوظيفي أو خط المترو)، تم إلغاء تسجيلك في المقرر «{course.title}» لأنه مخصص لفئة تنظيمية أخرى.",
            )
            record_audit_log(
                action="learning.enrollment_revoked_org_change",
                actor=actor,
                target_entity_type="Enrollment",
                target_entity_id=str(enrollment.id),
                details_snapshot={"userId": user.id, "courseId": course.id},
            )
    return revoked_courses


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
        draft_lesson = (
            LessonItem.objects.select_related("module")
            .filter(pk=lesson_item_id, module__course_draft__course=course)
            .first()
        )
        if draft_lesson is not None:
            lesson = (
                LessonItem.objects.filter(
                    module__published_version_id=attempt.published_version_id,
                    module__sort_order=draft_lesson.module.sort_order,
                    sort_order=draft_lesson.sort_order,
                ).first()
                or LessonItem.objects.filter(
                    module__published_version_id=attempt.published_version_id,
                    title=draft_lesson.title,
                ).first()
            )
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
        if last_position_seconds > 0 or lp.last_position_seconds == 0:
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

