"""Quiz scoring (WP55-PT-03), Version-Scoped Certificates (D-13, TR-C3-03) & Lecturer Performance."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
import hashlib
import secrets

from django.db import transaction
from django.utils import timezone

from apps.courses.models import Course, LessonItem, QuizDefinition
from apps.governance.services.governance_service import record_audit_log
from apps.identity.models import User
from apps.learning.models import (
    CertificateRecord,
    CourseAttempt,
    Enrollment,
    EnrollmentSourceGrant,
    LessonProgress,
)
from apps.learning.services.learning_service import compute_course_progress


class AssessmentDomainError(Exception):
    """Domain validation, scoring, or certificate conflict error."""

    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@transaction.atomic
def submit_quiz_attempt(
    *,
    user: User,
    course: Course,
    lesson_item_id: int,
    answers: dict | list,
) -> dict:
    """Evaluate QuizDefinition using exact Decimal percentage >= passing_score (WP55-PT-03)."""
    enrollment = Enrollment.objects.filter(user=user, course=course).first()
    if enrollment is None:
        raise AssessmentDomainError("NOT_ENROLLED", "المستخدم غير مسجل في هذه الدورة.", 404)
    if not EnrollmentSourceGrant.objects.filter(enrollment=enrollment).exists():
        raise AssessmentDomainError("ACCESS_REVOKED", "تم إيقاف صلاحية الوصول لهذه الدورة.", 403)

    attempt = (
        CourseAttempt.objects.select_for_update()
        .filter(enrollment=enrollment, is_sealed=False)
        .order_by("-id")
        .first()
    )
    if attempt is None:
        raise AssessmentDomainError("ATTEMPT_SEALED", "لا توجد محاولة نشطة غير مختومة.", 409)

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
        raise AssessmentDomainError("LESSON_NOT_IN_ATTEMPT", "الدرس غير موجود في نسخة المحاولة الحالية.", 404)

    quiz_def = QuizDefinition.objects.filter(lesson_item=lesson).first()
    if quiz_def is None:
        raise AssessmentDomainError("QUIZ_NOT_FOUND", "لا يوجد اختبار معرف لهذا الدرس.", 404)

    questions = quiz_def.questions_json or []
    if not isinstance(questions, list) or len(questions) == 0:
        raise AssessmentDomainError("EMPTY_QUIZ", "الاختبار لا يحتوي على أسئلة صالحة.", 400)

    total_points = Decimal("0")
    earned_points = Decimal("0")

    for idx, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        try:
            pts = Decimal(str(q.get("points", 1) or 1))
        except (InvalidOperation, ValueError, TypeError):
            pts = Decimal("1")
        if pts <= 0:
            continue
        total_points += pts

        q_id = str(q.get("id", idx))
        if isinstance(answers, dict):
            submitted = answers.get(q_id, answers.get(str(idx)))
        elif isinstance(answers, list) and idx < len(answers):
            submitted = answers[idx]
        else:
            submitted = None

        expected = q.get("correctIndex", q.get("correctOption", q.get("correctAnswer")))
        if submitted is not None and expected is not None and str(submitted) == str(expected):
            earned_points += pts

    if total_points <= 0:
        raise AssessmentDomainError("EMPTY_QUIZ", "إجمالي درجات الاختبار يجب أن يكون أكبر من صفر.", 400)

    # WP55-PT-03: Compare exact Decimal % >= passing_score without pre-rounding!
    exact_percent = (earned_points * Decimal("100")) / total_points
    passed = exact_percent >= quiz_def.passing_score

    now = timezone.now()
    if passed:
        lp = (
            LessonProgress.objects.select_for_update()
            .filter(course_attempt=attempt, lesson_item=lesson)
            .first()
        )
        if lp is None:
            LessonProgress.objects.create(
                course_attempt=attempt,
                lesson_item=lesson,
                is_completed=True,
                updated_at=now,
            )
        elif not lp.is_completed:
            lp.is_completed = True
            lp.updated_at = now
            lp.save(update_fields=["is_completed", "updated_at"])

    record_audit_log(
        action="learning.quiz_submitted",
        actor=user,
        target_entity_type="CourseAttempt",
        target_entity_id=str(attempt.id),
        details_snapshot={
            "lessonItemId": lesson.id,
            "scorePercent": str(exact_percent.quantize(Decimal("0.01"))),
            "passingScore": str(quiz_def.passing_score),
            "passed": passed,
        },
    )

    return {
        "lessonItemId": lesson.id,
        "scorePercent": float(exact_percent.quantize(Decimal("0.01"))),
        "passingScore": float(quiz_def.passing_score),
        "passed": passed,
        "progress": compute_course_progress(attempt),
    }


@transaction.atomic
def issue_certificate_for_attempt(*, actor: User, course_attempt_id: int) -> tuple[CertificateRecord, str]:
    """D-13 / TR-C3-03: Issue version-scoped CertificateRecord with SHA-256 BINARY(32) token hash."""
    attempt = (
        CourseAttempt.objects.select_for_update()
        .select_related("enrollment__user", "published_version__course")
        .filter(pk=course_attempt_id)
        .first()
    )
    if attempt is None:
        raise AssessmentDomainError("RESOURCE_NOT_FOUND", "المحاولة المطلوبة غير موجودة.", 404)

    if not EnrollmentSourceGrant.objects.filter(enrollment=attempt.enrollment).exists():
        raise AssessmentDomainError("ACCESS_REVOKED", "تم إيقاف صلاحية الوصول لهذه الدورة.", 403)

    if CertificateRecord.objects.filter(course_attempt=attempt).exists():
        raise AssessmentDomainError("CERTIFICATE_ALREADY_ISSUED", "تم إصدار شهادة لهذه المحاولة بالفعل.", 409)

    progress = compute_course_progress(attempt)
    if progress["totalLessons"] == 0 or progress["completedLessons"] < progress["totalLessons"]:
        raise AssessmentDomainError(
            "COURSE_NOT_COMPLETED",
            "لا يمكن إصدار الشهادة قبل إتمام 100% من متطلبات الدورة.",
            409,
        )

    raw_code = secrets.token_urlsafe(24)
    token_hash = hashlib.sha256(raw_code.encode("utf-8")).digest()
    now = timezone.now()
    pub = attempt.published_version
    serial = f"MLMS-{pub.course_id}-V{pub.version_number}-{attempt.id}"

    cert = CertificateRecord.objects.create(
        course_attempt=attempt,
        published_version=pub,
        verification_token_hash=token_hash,
        issued_at=now,
        revoked_at=None,
        certificate_serial=serial,
        recipient_name_snapshot=attempt.enrollment.user.full_name,
        course_title_snapshot=pub.course.title,
    )

    record_audit_log(
        action="learning.certificate_issued",
        actor=actor,
        target_entity_type="CertificateRecord",
        target_entity_id=str(cert.id),
        details_snapshot={"certificateSerial": serial, "courseVersion": pub.version_number},
    )
    return cert, raw_code


def verify_certificate_by_code(*, raw_code: str) -> dict:
    """TR-C3-03: Public PII-free certificate verification by SHA-256 token hash."""
    clean = raw_code.strip()
    if not clean:
        raise AssessmentDomainError("INVALID_CODE", "رمز التحقق من الشهادة مطلوب.", 400)
    token_hash = hashlib.sha256(clean.encode("utf-8")).digest()
    cert = (
        CertificateRecord.objects.select_related("published_version")
        .filter(verification_token_hash=token_hash)
        .first()
    )
    if cert is None:
        raise AssessmentDomainError("CERTIFICATE_NOT_FOUND", "الشهادة غير موجودة أو الرمز غير صحيح.", 404)

    return {
        "valid": cert.revoked_at is None,
        "status": "Revoked" if cert.revoked_at is not None else "Valid",
        "certificateSerial": cert.certificate_serial,
        "courseTitle": cert.course_title_snapshot,
        "courseVersion": cert.published_version.version_number,
        "issuedAt": cert.issued_at,
        "revokedAt": cert.revoked_at,
    }


@transaction.atomic
def revoke_certificate(*, actor: User, certificate_id: int, reason: str = "") -> CertificateRecord:
    """Revoke an issued CertificateRecord with audit log."""
    cert = CertificateRecord.objects.select_for_update().filter(pk=certificate_id).first()
    if cert is None:
        raise AssessmentDomainError("RESOURCE_NOT_FOUND", "الشهادة المطلوبة غير موجودة.", 404)
    if cert.revoked_at is not None:
        raise AssessmentDomainError("ALREADY_REVOKED", "تم إلغاء هذه الشهادة بالفعل.", 409)

    cert.revoked_at = timezone.now()
    cert.save(update_fields=["revoked_at"])
    record_audit_log(
        action="learning.certificate_revoked",
        actor=actor,
        target_entity_type="CertificateRecord",
        target_entity_id=str(cert.id),
        details_snapshot={"certificateSerial": cert.certificate_serial, "reason": reason.strip()},
    )
    return cert


def get_lecturer_course_performance(*, course: Course) -> dict:
    """Return per-learner performance & certificate summary for a course."""
    enrollments = (
        Enrollment.objects.filter(course=course)
        .select_related("user")
        .prefetch_related("source_grants", "attempts__certificates")
        .order_by("id")
    )
    learners = []
    completed_count = 0
    issued_certs = 0
    active_count = 0

    for enr in enrollments:
        has_access = enr.source_grants.exists()
        if has_access:
            active_count += 1
        latest_attempt = enr.attempts.order_by("-id").first()
        progress = compute_course_progress(latest_attempt) if latest_attempt else None
        is_completed = bool(progress and progress["progressPercent"] == 100)
        if is_completed:
            completed_count += 1
        cert = latest_attempt.certificates.order_by("-id").first() if latest_attempt else None
        if cert is not None and cert.revoked_at is None:
            issued_certs += 1

        pct = progress["progressPercent"] if progress else 0
        status_key = "completed" if is_completed else ("active" if pct > 0 else "not_started")
        status_ar = "مكتمل" if is_completed else ("قيد التدريب" if pct > 0 else "لم يبدأ")
        learners.append(
            {
                "userId": str(enr.user_id),
                "name": enr.user.full_name,
                "fullName": enr.user.full_name,
                "jobTitle": "متدرب",
                "department": "",
                "phone": enr.user.phone_e164,
                "hasActiveAccess": has_access,
                "progressPercent": pct,
                "isCompleted": is_completed,
                "status": status_key,
                "statusLabelAr": status_ar,
                "certificateSerial": cert.certificate_serial if cert else None,
                "certificateRevoked": cert.revoked_at is not None if cert else None,
            }
        )

    total_enrolled = len(learners)
    avg_pct = round(sum(x["progressPercent"] for x in learners) / total_enrolled) if total_enrolled else 0
    not_started = sum(1 for x in learners if x["status"] == "not_started")
    return {
        "courseId": str(course.id),
        "courseTitle": course.title,
        "lecturerId": str(course.primary_lecturer_id),
        "lecturerName": course.primary_lecturer.full_name if course.primary_lecturer else "",
        "totalEnrolled": total_enrolled,
        "activeEnrollments": active_count,
        "activeCount": active_count,
        "completedCount": completed_count,
        "lateCount": 0,
        "notStartedCount": not_started,
        "averageProgressPercent": avg_pct,
        "issuedCertificates": issued_certs,
        "learners": learners,
        "trainees": learners,
    }

