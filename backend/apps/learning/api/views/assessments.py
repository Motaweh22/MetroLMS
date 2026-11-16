"""Views for BP-10: Quiz Submission, Certificate Issuance/Verification/Revocation & Lecturer Performance."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.learning.models import CourseAttempt
from apps.learning.services.assessment_service import (
    AssessmentDomainError,
    get_lecturer_course_performance,
    issue_certificate_for_attempt,
    revoke_certificate,
    submit_quiz_attempt,
    verify_certificate_by_code,
)
from shared.api import error_response, success_response


class QuizSubmitView(APIView):
    """POST /api/courses/<course_id>/lessons/<lesson_id>/quiz/submit."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int, lesson_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        answers = request.data.get("answers", {})
        if not isinstance(answers, (dict, list)):
            return error_response("VALIDATION_ERROR", "صيغة الإجابات غير صالحة.", status.HTTP_400_BAD_REQUEST)
        try:
            result = submit_quiz_attempt(
                user=request.user,
                course=course,
                lesson_item_id=lesson_id,
                answers=answers,
            )
        except AssessmentDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(result)


class CertificateIssueView(APIView):
    """POST /api/attempts/<attempt_id>/certificate/issue."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, attempt_id: int):
        attempt = CourseAttempt.objects.select_related("enrollment").filter(pk=attempt_id).first()
        if attempt is None:
            return error_response("RESOURCE_NOT_FOUND", "المحاولة المطلوبة غير موجودة.", status.HTTP_404_NOT_FOUND)
        if attempt.enrollment.user_id != request.user.id and request.user.role_id not in {
            "developer",
            "super_admin",
            "admin",
        }:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إصدار شهادة لهذه المحاولة.", status.HTTP_403_FORBIDDEN)

        try:
            cert, raw_code = issue_certificate_for_attempt(actor=request.user, course_attempt_id=attempt.id)
        except AssessmentDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        return success_response(
            {
                "certificate": {
                    "id": cert.id,
                    "certificateSerial": cert.certificate_serial,
                    "recipientNameSnapshot": cert.recipient_name_snapshot,
                    "courseTitleSnapshot": cert.course_title_snapshot,
                    "courseVersion": cert.published_version.version_number,
                    "issuedAt": cert.issued_at,
                    "verificationCode": raw_code,
                }
            },
            status_code=status.HTTP_201_CREATED,
        )


class CertificateVerifyPublicView(APIView):
    """GET /api/certificates/verify/<code> — Public PII-free verification (TR-C3-03)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request: Request, code: str):
        try:
            data = verify_certificate_by_code(raw_code=code)
        except AssessmentDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(data)


class CertificateRevokeView(APIView):
    """POST /api/admin/certificates/<certificate_id>/revoke."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, certificate_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إلغاء الشهادات.", status.HTTP_403_FORBIDDEN)
        reason = str(request.data.get("reason", ""))
        try:
            cert = revoke_certificate(actor=request.user, certificate_id=certificate_id, reason=reason)
        except AssessmentDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "certificateId": cert.id,
                "certificateSerial": cert.certificate_serial,
                "revokedAt": cert.revoked_at,
            }
        )


class LecturerCoursePerformanceView(APIView):
    """GET /api/lecturer/courses/<course_id>/performance."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض أداء المتدربين في هذه الدورة.", status.HTTP_403_FORBIDDEN)
        return success_response(get_lecturer_course_performance(course=course))

