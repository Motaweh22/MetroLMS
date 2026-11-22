"""Views for apps.learning: Enrollments, D-06 Attempts, D-07 Group Removal & D-12 Progress."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.groups.models import GroupRenewalCycle, TrainingGroup
from apps.learning.api.serializers.learning import (
    CourseAttemptSerializer,
    EnrollmentSerializer,
    EnrollmentSourceGrantSerializer,
    LessonProgressSerializer,
)
from apps.learning.models import CourseAttempt, Enrollment, LessonProgress
from apps.learning.services.learning_service import (
    LearningDomainError,
    compute_course_progress,
    enroll_user_in_course,
    get_active_attempt_for_user,
    mark_lesson_complete,
    record_lesson_activity,
    revoke_group_enrollment_grant,
    start_new_attempt,
)
from shared.api import error_response, success_response
from shared.permissions import evaluate_permission, get_visible_user_or_none


class MyEnrollmentsView(APIView):
    """GET /api/enrollments/my — Trainee's enrollments with grants & latest attempt progress."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        from apps.courses.api.serializers.courses import CourseSerializer

        enrollments = (
            Enrollment.objects.filter(user=request.user)
            .select_related("course", "course__primary_lecturer")
            .prefetch_related("source_grants", "attempts")
            .order_by("id")
        )
        items = []
        for enr in enrollments:
            course_data = CourseSerializer(enr.course).data
            enr_data = EnrollmentSerializer(enr).data
            latest_attempt = enr.attempts.order_by("-id").first()
            prog = compute_course_progress(latest_attempt) if latest_attempt else None
            pct = prog["progressPercent"] if prog else 0
            completed_lessons = prog["completedLessons"] if prog else 0
            total_lessons = prog["totalLessons"] if prog else 0
            completed_ids = prog.get("completedItemIds", []) if prog else []
            is_completed = pct == 100
            items.append(
                {
                    **course_data,
                    **enr_data,
                    "id": str(enr.course_id) if request.query_params.get("enriched") == "true" else enr_data["id"],
                    "enrollmentId": str(enr.id),
                    "courseId": str(enr.course_id),
                    "userId": str(enr.user_id),
                    "latestProgress": prog,
                    "progress": {
                        "overallProgressPercentage": pct,
                        "completedItemIds": completed_ids,
                        "isCompleted": is_completed,
                        "completedLessons": completed_lessons,
                        "totalLessons": total_lessons,
                    },
                    "isExpired": not enr_data.get("hasActiveAccess", True),
                    "canCertify": is_completed and bool(enr_data.get("hasActiveAccess", True)),
                }
            )
        return success_response({"enrollments": items})


class CourseEnrollmentsView(APIView):
    """GET / POST /api/courses/<course_id>/enrollments."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_course_staff = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_course_staff:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض المسجلين في هذه الدورة.", status.HTTP_403_FORBIDDEN)
        rows = (
            Enrollment.objects.filter(course=course, source_grants__isnull=False)
            .select_related("user")
            .prefetch_related("source_grants")
            .distinct()
            .order_by("id")
        )
        return success_response({"enrollments": EnrollmentSerializer(rows, many=True).data})

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        raw_user_id = request.data.get("userId")
        target_user_id = int(raw_user_id) if raw_user_id is not None else request.user.id
        if target_user_id != request.user.id:
            decision = evaluate_permission(request.user, "users.manage_enrollments")
            is_course_staff = (
                request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
                or course.primary_lecturer_id == request.user.id
                or course.assistant_lecturers.filter(user=request.user).exists()
            )
            if not decision.granted and not is_course_staff:
                return error_response("PERMISSION_DENIED", decision.reason_ar, status.HTTP_403_FORBIDDEN)
        target_user = get_visible_user_or_none(request.user, target_user_id)
        if target_user is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        source_type = str(request.data.get("sourceType", "direct"))
        group_id = request.data.get("trainingGroupId")
        group = TrainingGroup.objects.filter(pk=int(group_id)).first() if group_id is not None else None
        if group_id is not None and group is None:
            return error_response("RESOURCE_NOT_FOUND", "المجموعة التدريبية غير موجودة.", status.HTTP_404_NOT_FOUND)

        cycle_id = request.data.get("groupRenewalCycleId")
        cycle = GroupRenewalCycle.objects.filter(pk=int(cycle_id)).first() if cycle_id is not None else None

        try:
            enr, grant, attempt = enroll_user_in_course(
                actor=request.user,
                user=target_user,
                course=course,
                source_type=source_type,
                training_group=group,
                group_renewal_cycle=cycle,
            )
        except LearningDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        return success_response(
            {
                "enrollment": EnrollmentSerializer(enr).data,
                "grant": EnrollmentSourceGrantSerializer(grant).data,
                "attempt": CourseAttemptSerializer(attempt).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class CourseEnrollmentsBulkAddView(APIView):
    """POST /api/courses/<course_id>/enrollments/bulk-add — Direct member enrollment."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_course_staff = (
            request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_course_staff:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إضافة أعضاء لهذه الدورة.", status.HTTP_403_FORBIDDEN)

        raw_ids = request.data.get("userIds", [])
        if not isinstance(raw_ids, list) or not raw_ids:
            return error_response("VALIDATION_ERROR", "يرجى تحديد عضو واحد على الأقل.", status.HTTP_400_BAD_REQUEST)

        added_count = 0
        for raw_uid in raw_ids:
            try:
                uid = int(raw_uid)
            except (TypeError, ValueError):
                continue
            target_user = get_visible_user_or_none(request.user, uid)
            if target_user is None:
                continue
            enroll_user_in_course(
                actor=request.user,
                user=target_user,
                course=course,
                source_type="direct",
            )
            added_count += 1

        rows = (
            Enrollment.objects.filter(course=course, source_grants__isnull=False)
            .select_related("user")
            .prefetch_related("source_grants")
            .distinct()
            .order_by("id")
        )
        return success_response(
            {
                "addedCount": added_count,
                "enrollments": EnrollmentSerializer(rows, many=True).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class CourseEnrollmentDirectGrantRevokeView(APIView):
    """DELETE /api/courses/<course_id>/enrollments/<user_id>/direct-grant."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, course_id: int, user_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_course_staff = (
            request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_course_staff:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل المسجلين في هذه الدورة.", status.HTTP_403_FORBIDDEN)

        from apps.learning.models import EnrollmentSourceGrant

        enrollment = Enrollment.objects.filter(user_id=user_id, course=course).first()
        if enrollment is None:
            return error_response("RESOURCE_NOT_FOUND", "التسجيل غير موجود.", status.HTTP_404_NOT_FOUND)

        EnrollmentSourceGrant.objects.filter(
            enrollment=enrollment,
            source_type__in=["direct", "qr_code", "self:continued"],
        ).delete()
        remaining = enrollment.source_grants.exists()
        return success_response({"revoked": True, "hasActiveAccess": remaining})


class CourseEnrollmentGroupGrantRevokeView(APIView):
    """DELETE /api/courses/<course_id>/enrollments/<user_id>/group-grant — D-07."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, course_id: int, user_id: int):
        decision = evaluate_permission(request.user, "users.manage_enrollments")
        if not decision.granted and request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", decision.reason_ar, status.HTTP_403_FORBIDDEN)

        course = Course.objects.filter(pk=course_id).first()
        target_user = get_visible_user_or_none(request.user, user_id)
        if course is None or target_user is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        group_id = request.data.get("trainingGroupId") or request.query_params.get("trainingGroupId")
        if group_id is None:
            return error_response("GROUP_REQUIRED", "معرّف المجموعة التدريبية مطلوب.", status.HTTP_400_BAD_REQUEST)
        group = TrainingGroup.objects.filter(pk=int(group_id)).first()
        if group is None:
            return error_response("RESOURCE_NOT_FOUND", "المجموعة التدريبية غير موجودة.", status.HTTP_404_NOT_FOUND)

        convert = bool(request.data.get("convertToSelfContinued", False))
        try:
            result = revoke_group_enrollment_grant(
                actor=request.user,
                user=target_user,
                course=course,
                training_group=group,
                convert_to_self_continued=convert,
            )
        except LearningDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(result)


class UserCourseAttemptsView(APIView):
    """GET / POST /api/users/<user_id>/courses/<course_id>/attempts — D-06."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, user_id: int, course_id: int):
        target_user = get_visible_user_or_none(request.user, user_id)
        course = Course.objects.filter(pk=course_id).first()
        if target_user is None or course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if target_user.id != request.user.id and request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض محاولات هذا المتدرب.", status.HTTP_403_FORBIDDEN)

        attempts = CourseAttempt.objects.filter(
            enrollment__user=target_user, enrollment__course=course
        ).order_by("id")
        return success_response({"attempts": CourseAttemptSerializer(attempts, many=True).data})

    def post(self, request: Request, user_id: int, course_id: int):
        target_user = get_visible_user_or_none(request.user, user_id)
        course = Course.objects.filter(pk=course_id).first()
        if target_user is None or course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if target_user.id != request.user.id and request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية بدء محاولة جديدة لهذا المتدرب.", status.HTTP_403_FORBIDDEN)

        cycle_id = request.data.get("groupRenewalCycleId")
        cycle = GroupRenewalCycle.objects.filter(pk=int(cycle_id)).first() if cycle_id is not None else None
        try:
            attempt = start_new_attempt(actor=request.user, user=target_user, course=course, group_renewal_cycle=cycle)
        except LearningDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"attempt": CourseAttemptSerializer(attempt).data}, status_code=status.HTTP_201_CREATED)


class CourseProgressView(APIView):
    """GET /api/courses/<course_id>/progress — D-12 progress & per-lesson telemetry."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        raw_attempt = request.query_params.get("attemptId")
        attempt_id = int(raw_attempt) if raw_attempt is not None else None
        try:
            attempt = get_active_attempt_for_user(user=request.user, course=course, attempt_id=attempt_id)
        except LearningDomainError as exc:
            if request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
                return success_response(
                    {
                        "progress": {
                            "progressPercent": 0,
                            "completedLessons": 0,
                            "totalLessons": 0,
                            "completedItemIds": [],
                            "accessMode": "review_only",
                        },
                        "lessons": [],
                    }
                )
            return error_response(exc.code, exc.message, exc.status_code)
        lessons = LessonProgress.objects.filter(course_attempt=attempt).order_by("lesson_item_id")
        return success_response(
            {
                "progress": compute_course_progress(attempt),
                "lessons": LessonProgressSerializer(lessons, many=True).data,
            }
        )


class LessonActivityView(APIView):
    """POST /api/courses/<course_id>/lessons/<lesson_id>/activity."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int, lesson_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            lp, progress = record_lesson_activity(
                user=request.user,
                course=course,
                lesson_item_id=lesson_id,
                last_position_seconds=int(request.data.get("lastPositionSeconds", 0)),
                furthest_watched_seconds=int(request.data.get("furthestWatchedSeconds", 0)),
                eligible_delta_seconds=int(request.data.get("eligibleDeltaSeconds", 0)),
                increment_watch_count=bool(request.data.get("incrementWatchCount", False)),
            )
        except LearningDomainError as exc:
            if exc.code in {"NOT_ENROLLED", "ATTEMPT_SEALED", "LESSON_NOT_IN_ATTEMPT"}:
                return success_response(
                    {
                        "lessonProgress": {
                            "lessonItemId": lesson_id,
                            "isCompleted": False,
                            "lastPositionSeconds": int(request.data.get("lastPositionSeconds", 0)),
                            "furthestWatchedSeconds": int(request.data.get("furthestWatchedSeconds", 0)),
                            "eligibleViewingSeconds": 0,
                            "watchCount": 0,
                        },
                        "progress": None,
                    }
                )
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"lessonProgress": LessonProgressSerializer(lp).data, "progress": progress})


class CourseEnrollmentStatusView(APIView):
    """GET /api/courses/<course_id>/enrollment — Single course enrollment status for current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        enr = Enrollment.objects.filter(user=request.user, course_id=course_id).prefetch_related("source_grants").first()
        if enr is None:
            return success_response({"isEnrolled": False, "hasActiveAccess": False, "enrollment": None})
        has_access = enr.source_grants.exists()
        return success_response(
            {
                "isEnrolled": has_access,
                "hasActiveAccess": has_access,
                "enrollment": EnrollmentSerializer(enr).data,
            }
        )


class LessonCompleteView(APIView):
    """POST /api/courses/<course_id>/lessons/<lesson_id>/complete."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int, lesson_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            lp, progress = mark_lesson_complete(user=request.user, course=course, lesson_item_id=lesson_id)
        except LearningDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"lessonProgress": LessonProgressSerializer(lp).data, "progress": progress})


class CourseEnrollmentStatusView(APIView):
    """GET /api/courses/<course_id>/enrollment — Single course enrollment status for current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        enr = Enrollment.objects.filter(user=request.user, course_id=course_id).prefetch_related("source_grants").first()
        if enr is None:
            return success_response({"isEnrolled": False, "hasActiveAccess": False, "enrollment": None})
        has_access = enr.source_grants.exists()
        return success_response(
            {
                "isEnrolled": has_access,
                "hasActiveAccess": has_access,
                "enrollment": EnrollmentSerializer(enr).data,
            }
        )

