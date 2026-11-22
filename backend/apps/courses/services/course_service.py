"""Courses, curriculum draft/publish, review & comment domain services."""
from __future__ import annotations

from decimal import Decimal
import secrets
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.courses.models import (
    Course,
    CourseAssistantLecturer,
    CourseAudienceDepartment,
    CourseAudienceJobTitle,
    CourseAudienceMetroLine,
    CourseComment,
    CourseCommentReport,
    CourseDraft,
    CourseQrCode,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
    QuizDefinition,
    StagedAdminEdit,
    WorkingNote,
)
from apps.governance.services.governance_service import record_audit_log
from apps.identity.models import User
from apps.organization.models import UserOrganizationalDepartment
from shared.validators import (
    normalize_nfc_preserve_whitespace,
    normalize_nfc_stripped,
    normalize_optional_url,
    validate_https_url,
    validate_non_empty_text,
)


class CourseDomainError(Exception):
    """Domain validation or conflict error in apps.courses."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def can_edit_course_draft(actor: User, course: Course) -> bool:
    """Enforce TR-C2-02: assistant_admin gets no implicit draft edit permission."""
    if actor.role_id in {"developer", "super_admin", "admin"}:
        return True
    if course.primary_lecturer_id == actor.id:
        return True
    return CourseAssistantLecturer.objects.filter(course=course, user=actor).exists()


@transaction.atomic
def create_course(
    *,
    actor: User,
    title: str,
    course_type: str,
    primary_lecturer: User,
    description: str | None = None,
    main_course: Course | None = None,
) -> Course:
    """Create Course + initial CourseDraft, enforcing TR-C2-01 terminal-child invariant."""
    norm_title = normalize_nfc_stripped(title)
    validate_non_empty_text(norm_title)
    norm_desc = normalize_nfc_preserve_whitespace(description) if description is not None else None

    if course_type == "main":
        if main_course is not None:
            raise CourseDomainError("INVALID_MAIN_COURSE", "الدورة الرئيسية لا ترتبط بدورة أصلية.")
    elif course_type == "reminder":
        if main_course is None:
            raise CourseDomainError("MAIN_COURSE_REQUIRED", "الدورة التذكيرية يجب أن ترتبط بدورة رئيسية.")
        if main_course.course_type != "main":
            raise CourseDomainError(
                "REMINDER_CHAIN_PROHIBITED",
                "لا يمكن ربط دورة تذكيرية بدورة تذكيرية أخرى (TR-C2-01).",
                status_code=409,
            )
    else:
        raise CourseDomainError("INVALID_COURSE_TYPE", "نوع الدورة غير صالح.")

    now = timezone.now()
    course = Course.objects.create(
        title=norm_title,
        description=norm_desc,
        course_type=course_type,
        main_course=main_course,
        primary_lecturer=primary_lecturer,
        lifecycle_status="Draft",
        created_by_user=actor,
        created_at=now,
        updated_at=now,
    )
    CourseDraft.objects.create(
        course=course,
        title_snapshot=norm_title,
        updated_at=now,
        updated_by_user=actor,
    )
    record_audit_log(
        action="course.created",
        actor=actor,
        target_entity_type="Course",
        target_entity_id=str(course.id),
        details_snapshot={"courseType": course_type},
    )
    return course


@transaction.atomic
def save_course_draft(
    *,
    actor: User,
    course: Course,
    title_snapshot: str,
    modules_payload: list[dict[str, Any]],
    thumbnail_asset_id: int | None = None,
    refresher_config: dict[str, Any] | None = None,
) -> CourseDraft:
    """Replace mutable CourseDraft curriculum structure cleanly (Rule B)."""
    if not can_edit_course_draft(actor, course):
        raise CourseDomainError("PERMISSION_DENIED", "غير مصرح لك بتعديل منهج هذه الدورة.", status_code=403)

    norm_title = normalize_nfc_stripped(title_snapshot)
    validate_non_empty_text(norm_title)
    now = timezone.now()

    defaults: dict[str, Any] = {
        "title_snapshot": norm_title,
        "updated_at": now,
        "updated_by_user": actor,
        "updated_by_tombstone": None,
    }
    if refresher_config is not None:
        defaults["refresher_config_json"] = refresher_config

    draft, _ = CourseDraft.objects.update_or_create(
        course=course,
        defaults=defaults,
    )

    # Clear existing draft modules -> quizzes -> lessons -> modules & draft media refs (ON DELETE NO ACTION)
    from apps.media.models import MediaAsset, MediaContentReference

    MediaContentReference.objects.filter(course_draft=draft).delete()
    if thumbnail_asset_id is not None:
        cover_asset = MediaAsset.objects.filter(pk=thumbnail_asset_id).first()
        if cover_asset is not None:
            MediaContentReference.objects.create(
                media_asset=cover_asset,
                course_draft=draft,
                title="__course_cover__",
                is_visible=True,
            )
    old_modules = list(Module.objects.filter(course_draft=draft).values_list("id", flat=True))
    if old_modules:
        old_lessons = list(LessonItem.objects.filter(module_id__in=old_modules).values_list("id", flat=True))
        if old_lessons:
            QuizDefinition.objects.filter(lesson_item_id__in=old_lessons).delete()
            LessonItem.objects.filter(id__in=old_lessons).delete()
        Module.objects.filter(id__in=old_modules).delete()

    for m_idx, m_data in enumerate(modules_payload):
        m_title = normalize_nfc_stripped(str(m_data.get("title", "")))
        validate_non_empty_text(m_title)
        mod = Module.objects.create(
            course_draft=draft,
            title=m_title,
            sort_order=int(m_data.get("sortOrder", m_idx)),
        )
        lessons_list = m_data.get("lessons") if m_data.get("lessons") is not None else m_data.get("items", [])
        for l_idx, l_data in enumerate(lessons_list):
            l_title = normalize_nfc_stripped(str(l_data.get("title", "")))
            validate_non_empty_text(l_title)
            raw_ext = l_data.get("externalVideoUrl") or l_data.get("externalUrl") or l_data.get("videoUrl")
            if isinstance(raw_ext, str) and raw_ext.startswith("blob:"):
                raw_ext = None
            ext_url = normalize_optional_url(raw_ext)
            if ext_url:
                validate_https_url(ext_url)
            raw_dl = str(l_data.get("downloadPolicy") or ("immediate" if l_data.get("canDownload") else "never")).strip()
            dl_policy = (
                raw_dl
                if raw_dl in {"immediate", "after_item_completion", "after_course_completion", "never"}
                else "never"
            )
            lesson = LessonItem.objects.create(
                module=mod,
                title=l_title,
                lesson_type=str(l_data.get("lessonType") or l_data.get("type") or "video"),
                sort_order=int(l_data.get("sortOrder", l_idx)),
                external_video_url=ext_url,
                duration_seconds=int(l_data.get("durationSeconds", 0) or 0),
                download_policy=dl_policy,
            )
            raw_media_id = l_data.get("mediaId") or l_data.get("mediaAssetId")
            if raw_media_id is not None and str(raw_media_id).isdigit():
                asset = MediaAsset.objects.filter(pk=int(raw_media_id)).first()
                if asset is not None:
                    MediaContentReference.objects.create(
                        media_asset=asset,
                        course_draft=draft,
                        title=l_title,
                        is_visible=True,
                    )
            quiz_data = l_data.get("quiz")
            if isinstance(quiz_data, dict):
                QuizDefinition.objects.create(
                    lesson_item=lesson,
                    questions_json=quiz_data.get("questions", []),
                    passing_score=Decimal(str(quiz_data.get("passingScore", "70.00"))),
                )

    # Register MediaContentReference for any media uploaded in refresher-only items/chapters
    effective_refresher = draft.refresher_config_json if isinstance(draft.refresher_config_json, dict) else {}
    refresher_items_to_ref: list[dict[str, Any]] = []
    for r_ch in effective_refresher.get("extraChapters", []) or []:
        if isinstance(r_ch, dict):
            refresher_items_to_ref.extend(
                [it for it in (r_ch.get("items") or []) if isinstance(it, dict)]
            )
    extra_by_ch = effective_refresher.get("extraItemsByChapter") or {}
    if isinstance(extra_by_ch, dict):
        for r_items in extra_by_ch.values():
            if isinstance(r_items, list):
                refresher_items_to_ref.extend([it for it in r_items if isinstance(it, dict)])

    for r_item in refresher_items_to_ref:
        raw_media_id = r_item.get("mediaId") or r_item.get("mediaAssetId")
        r_item_id = str(r_item.get("id") or "").strip()
        if raw_media_id is not None and str(raw_media_id).isdigit() and r_item_id:
            asset = MediaAsset.objects.filter(pk=int(raw_media_id)).first()
            if asset is not None:
                MediaContentReference.objects.create(
                    media_asset=asset,
                    course_draft=draft,
                    title=f"__refresher__{r_item_id}",
                    is_visible=True,
                )
    return draft


@transaction.atomic
def submit_course_for_review(*, actor: User, course: Course) -> CourseReviewSubmission:
    """Submit Course for review (OD-PF-07 non-empty description gate & OD-PF-03-B)."""
    if not can_edit_course_draft(actor, course):
        raise CourseDomainError("PERMISSION_DENIED", "غير مصرح لك بتقديم هذه الدورة للمراجعة.", status_code=403)
    if not course.description or not course.description.strip():
        raise CourseDomainError(
            "DESCRIPTION_REQUIRED_FOR_REVIEW",
            "وصف الدورة مطلوب قبل إرسالها للمراجعة.",
            status_code=400,
        )

    now = timezone.now()
    submission = CourseReviewSubmission.objects.create(
        course=course,
        submitted_by_user=actor,
        review_status="Pending",
        submitted_at=now,
    )
    # OD-PF-03-B: Keep Published courses Published during update review
    if course.lifecycle_status == "Draft":
        course.lifecycle_status = "InReview"
        course.updated_at = now
        course.save(update_fields=["lifecycle_status", "updated_at"])

    record_audit_log(
        action="course.review_submitted",
        actor=actor,
        target_entity_type="CourseReviewSubmission",
        target_entity_id=str(submission.id),
    )
    return submission


@transaction.atomic
def decide_course_review(
    *,
    reviewer: User,
    submission: CourseReviewSubmission,
    decision: str,
    note_body: str | None = None,
) -> tuple[CourseReviewSubmission, PublishedCourseVersion | None]:
    """Approve & publish immutable PublishedCourseVersion, or return for revision."""
    if submission.review_status != "Pending":
        raise CourseDomainError("ALREADY_DECIDED", "تم البت في طلب المراجعة هذا بالفعل.", status_code=409)

    now = timezone.now()
    submission.reviewed_by_user = reviewer
    submission.decided_at = now

    if note_body is not None and note_body.strip():
        WorkingNote.objects.create(
            submission=submission,
            note_body=normalize_nfc_preserve_whitespace(note_body),
            created_at=now,
        )

    if decision == "return":
        submission.review_status = "ReturnedForRevision"
        submission.save(update_fields=["review_status", "reviewed_by_user", "decided_at"])
        return submission, None

    if decision != "approve":
        raise CourseDomainError("INVALID_DECISION", "يجب أن يكون القرار approve أو return.")

    submission.review_status = "Approved"
    submission.save(update_fields=["review_status", "reviewed_by_user", "decided_at"])

    course = submission.course
    draft = CourseDraft.objects.filter(course=course).first()
    max_ver = PublishedCourseVersion.objects.filter(course=course).aggregate(m=Max("version_number"))["m"] or 0
    pub_ver = PublishedCourseVersion.objects.create(
        course=course,
        version_number=max_ver + 1,
        refresher_config_json=draft.refresher_config_json if draft is not None else None,
        published_at=now,
        published_by_user=reviewer,
    )

    # Snapshot CourseDraft -> PublishedCourseVersion (Rule B)
    if draft is not None:
        for mod in Module.objects.filter(course_draft=draft).order_by("sort_order", "id"):
            pub_mod = Module.objects.create(
                published_version=pub_ver,
                title=mod.title,
                sort_order=mod.sort_order,
            )
            for lesson in LessonItem.objects.filter(module=mod).order_by("sort_order", "id"):
                pub_lesson = LessonItem.objects.create(
                    module=pub_mod,
                    title=lesson.title,
                    lesson_type=lesson.lesson_type,
                    sort_order=lesson.sort_order,
                    external_video_url=lesson.external_video_url,
                    duration_seconds=lesson.duration_seconds,
                    download_policy=lesson.download_policy,
                )
                quiz = QuizDefinition.objects.filter(lesson_item=lesson).first()
                if quiz is not None:
                    QuizDefinition.objects.create(
                        lesson_item=pub_lesson,
                        questions_json=quiz.questions_json,
                        passing_score=quiz.passing_score,
                    )
        from apps.media.models import MediaContentReference

        for d_ref in MediaContentReference.objects.filter(course_draft=draft, detached_at__isnull=True):
            MediaContentReference.objects.create(
                media_asset=d_ref.media_asset,
                published_version=pub_ver,
                title=d_ref.title,
                is_visible=d_ref.is_visible,
            )

    course.lifecycle_status = "Published"
    if draft is not None:
        course.title = draft.title_snapshot
    course.updated_at = now
    course.save(update_fields=["lifecycle_status", "title", "updated_at"])

    record_audit_log(
        action="course.published",
        actor=reviewer,
        target_entity_type="PublishedCourseVersion",
        target_entity_id=str(pub_ver.id),
        details_snapshot={"courseId": course.id, "versionNumber": pub_ver.version_number},
    )
    _notify_eligible_trainees_on_publish(course)
    return submission, pub_ver


def _notify_eligible_trainees_on_publish(course: Course) -> int:
    """Send NotificationItem to eligible active trainees when a non-hidden course is published."""
    access_mode = getattr(course, "access_mode", "targeted") or "targeted"
    if access_mode == "hidden":
        return 0

    from apps.communications.models import NotificationItem

    active_trainees = User.objects.filter(role_id="trainee", status="Active").only("id", "metro_line_id")
    if access_mode == "all_trainees":
        recipients = list(active_trainees)
    else:
        recipients = [u for u in active_trainees if is_course_visible_to_trainee(u, course)]

    if not recipients:
        return 0

    title = f"مقرر تدريبي جديد متاح لك: {course.title}"
    body = f"أصبح المقرر التدريبي «{course.title}» متاحاً الآن في كتالوج المقررات ضمن الفئة المستهدفة الخاصة بك."
    existing_user_ids = set(
        NotificationItem.objects.filter(user__in=recipients, title=title).values_list("user_id", flat=True)
    )
    now = timezone.now()
    to_create = [
        NotificationItem(user=u, title=title, body=body, is_read=False, created_at=now)
        for u in recipients
        if u.id not in existing_user_ids
    ]
    if to_create:
        NotificationItem.objects.bulk_create(to_create)
    return len(to_create)


def does_user_match_course_audience(user: User, course: Course) -> bool:
    """Return True if user's dept, job title, metro line, or leadership title matches course audience targeting."""
    from apps.courses.models import CourseAudienceLeadership

    dept_ids = set(CourseAudienceDepartment.objects.filter(course=course).values_list("department_id", flat=True))
    job_ids = set(CourseAudienceJobTitle.objects.filter(course=course).values_list("job_title_id", flat=True))
    line_ids = set(CourseAudienceMetroLine.objects.filter(course=course).values_list("metro_line_id", flat=True))
    leadership_titles = set(
        CourseAudienceLeadership.objects.filter(course=course).values_list("leadership_title", flat=True)
    )

    user_depts = set(UserOrganizationalDepartment.objects.filter(user=user).values_list("department_id", flat=True))
    user_jobs = set(user.user_job_titles.values_list("job_title_id", flat=True))
    user_leadership = (getattr(user, "leadership_title", None) or "").strip()

    if not dept_ids and not job_ids and not line_ids and not leadership_titles:
        has_user_org_profile = bool(user.metro_line_id or user_depts or user_jobs)
        return not has_user_org_profile

    if user_leadership and user_leadership in leadership_titles:
        return True
    if user.metro_line_id in line_ids:
        return True
    if user_depts & dept_ids:
        return True
    return bool(user_jobs & job_ids)


def is_course_visible_to_trainee(user: User, course: Course) -> bool:
    """Visibility across access_mode (all_trainees / targeted / hidden), enrollments & groups."""
    if course.lifecycle_status != "Published":
        return False
    from apps.groups.models import GroupCourseAssignment
    from apps.learning.models import Enrollment

    if Enrollment.objects.filter(user=user, course=course, source_grants__isnull=False).exists():
        return True
    if GroupCourseAssignment.objects.filter(
        course=course,
        group_renewal_cycle__training_group__memberships__user=user,
    ).exists():
        return True

    access_mode = getattr(course, "access_mode", "targeted") or "targeted"
    if access_mode == "hidden":
        return False
    if access_mode == "all_trainees":
        return True

    return does_user_match_course_audience(user, course)


def add_course_comment(*, author: User, course: Course, body: str) -> CourseComment:
    """Create a CourseComment preserving whitespace (OR-DB-04 Condition A)."""
    validate_non_empty_text(body)
    return CourseComment.objects.create(
        course=course,
        author_user=author,
        is_author_deleted=False,
        body=normalize_nfc_preserve_whitespace(body),
        created_at=timezone.now(),
    )


def report_course_comment(*, reporter: User, comment: CourseComment, reason: str) -> CourseCommentReport:
    """Create a CourseCommentReport with OR-DB-04 Condition A reason."""
    validate_non_empty_text(reason)
    return CourseCommentReport.objects.create(
        comment=comment,
        reporter_user=reporter,
        reason=normalize_nfc_preserve_whitespace(reason),
        status="Pending",
        created_at=timezone.now(),
    )


def get_or_create_course_qr(course: Course) -> CourseQrCode:
    """Return or lazily initialize a CourseQrCode configuration for a course."""
    qr = CourseQrCode.objects.filter(course=course).first()
    if qr is not None:
        return qr
    return CourseQrCode.objects.create(
        course=course,
        token=secrets.token_urlsafe(18),
        is_enabled=True,
        qr_mode="view_only",
        expires_at=None,
        updated_at=timezone.now(),
    )


def rotate_course_qr(course: Course) -> CourseQrCode:
    """Generate a new QR token for the course, invalidating prior links."""
    qr = get_or_create_course_qr(course)
    qr.token = secrets.token_urlsafe(18)
    qr.updated_at = timezone.now()
    qr.save(update_fields=["token", "updated_at"])
    return qr


def update_course_qr_settings(
    course: Course,
    *,
    is_enabled: bool | None = None,
    qr_mode: str | None = None,
    expires_at: Any = ...,
) -> CourseQrCode:
    """Update CourseQrCode settings."""
    qr = get_or_create_course_qr(course)
    update_fields = ["updated_at"]
    if is_enabled is not None:
        qr.is_enabled = bool(is_enabled)
        update_fields.append("is_enabled")
    if qr_mode is not None:
        if qr_mode not in {"view_only", "auto_enroll"}:
            raise CourseDomainError("VALIDATION_ERROR", "نمط رمز QR غير صالح.", 400)
        qr.qr_mode = qr_mode
        update_fields.append("qr_mode")
    if expires_at is not ...:
        qr.expires_at = expires_at
        update_fields.append("expires_at")
    qr.updated_at = timezone.now()
    qr.save(update_fields=update_fields)
    return qr



def anonymize_user_comments(user: User) -> int:
    """D-02: Anonymize CourseComment author on D-01 deletion ('مستخدم محذوف')."""
    return CourseComment.objects.filter(author_user=user).update(
        author_user=None,
        is_author_deleted=True,
    )

