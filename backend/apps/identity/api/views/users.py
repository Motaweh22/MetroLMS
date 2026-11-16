"""Admin user lifecycle endpoints (D-01 deletion cascade)."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.identity.api.serializers.auth import AuthenticatedUserSerializer
from apps.identity.models import User
from apps.identity.services.user_deletion_service import UserDeletionError, delete_user_with_d01_cascade
from apps.learning.models import Enrollment
from shared.api import error_response, success_response
from shared.permissions import get_visible_user_or_none


class ProfileView(APIView):
    """GET /api/profile — Authenticated user profile & learning summary."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user_data = AuthenticatedUserSerializer(request.user).data
        user_data["name"] = request.user.full_name
        user_data["role"] = "user" if request.user.role_id == "trainee" else request.user.role_id
        user_data["initials"] = request.user.full_name[:2] if request.user.full_name else "م"
        user_data["department"] = ""
        user_data["jobTitle"] = ""
        enrolled = Enrollment.objects.filter(user=request.user).count()
        return success_response(
            {
                "user": user_data,
                "stats": {
                    "totalLearningHours": 0,
                    "enrolledCoursesCount": enrolled,
                    "completedCoursesCount": 0,
                },
            }
        )


class AdminUserListView(APIView):
    """GET /api/admin/users — Directory listing (INV-R8 developer hidden from non-developers)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض دليل المستخدمين.", status.HTTP_403_FORBIDDEN)
        qs = User.objects.all().order_by("id")
        if request.user.role_id != "developer":
            qs = qs.exclude(role_id="developer")
        role_filter = request.query_params.get("role")
        if role_filter:
            mapped = "trainee" if role_filter == "user" else role_filter
            qs = qs.filter(role_id=mapped)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        users = [
            {
                "id": str(u.id),
                "name": u.full_name,
                "phoneE164": u.phone_e164,
                "email": u.email or u.phone_e164,
                "role": "user" if u.role_id == "trainee" else u.role_id,
                "status": u.status,
                "department": "",
                "jobTitle": "",
                "initials": u.full_name[:2] if u.full_name else "م",
            }
            for u in qs
        ]
        return success_response(users)

    def post(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إنشاء مستخدمين.", status.HTTP_403_FORBIDDEN)
        name = str(request.data.get("name") or request.data.get("fullName") or "").strip()
        phone = str(request.data.get("phoneE164") or request.data.get("phone") or "").strip()
        password = str(request.data.get("password") or "Metro@12345")
        raw_role = str(request.data.get("role") or "user").strip()
        role_id = "trainee" if raw_role == "user" else raw_role
        email = request.data.get("email") or None
        if not name or not phone:
            return error_response("VALIDATION_ERROR", "الاسم ورقم الهاتف مطلوبان.", status.HTTP_400_BAD_REQUEST)
        if role_id not in {"super_admin", "admin", "assistant_admin", "lecturer", "trainee"}:
            return error_response("VALIDATION_ERROR", "الدور المحدد غير صالح.", status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(phone_e164=phone).exists():
            return error_response("CONFLICT", "رقم الهاتف مسجل بالفعل.", status.HTTP_409_CONFLICT)
        user = User.objects.create_user(
            phone_e164=phone,
            full_name=name,
            role_id=role_id,
            password=password,
            email=email,
            status="Active",
        )
        return success_response(
            {
                "id": str(user.id),
                "name": user.full_name,
                "phoneE164": user.phone_e164,
                "email": user.email or user.phone_e164,
                "role": "user" if user.role_id == "trainee" else user.role_id,
                "status": user.status,
                "department": "",
                "jobTitle": "",
                "initials": user.full_name[:2] if user.full_name else "م",
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminUserDeleteView(APIView):
    """DELETE /api/admin/users/<user_id> — D-01 atomic deletion cascade."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف المستخدمين.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        reason = str(request.data.get("reason", "")) if isinstance(request.data, dict) else ""
        try:
            tombstone = delete_user_with_d01_cascade(actor=request.user, target_user=target, reason=reason)
        except UserDeletionError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "deleted": True,
                "tombstoneId": tombstone.id,
                "canonicalUserId": tombstone.canonical_user_id,
            }
        )


class AdminUserRoleView(APIView):
    """PUT / PATCH / POST /api/admin/users/<user_id>/role."""

    permission_classes = [IsAuthenticated]

    def _update_role(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل أدوار المستخدمين.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        raw_role = str(request.data.get("role") or request.data.get("newRole") or "").strip()
        mapped_role = "trainee" if raw_role == "user" else raw_role
        if mapped_role not in {"super_admin", "admin", "assistant_admin", "lecturer", "trainee"}:
            return error_response("VALIDATION_ERROR", "الدور المحدد غير صالح.", status.HTTP_400_BAD_REQUEST)
        target.role_id = mapped_role
        target.save(update_fields=["role"])
        return success_response(
            {
                "id": str(target.id),
                "role": "user" if target.role_id == "trainee" else target.role_id,
                "status": target.status,
            }
        )

    def put(self, request: Request, user_id: int):
        return self._update_role(request, user_id)

    def patch(self, request: Request, user_id: int):
        return self._update_role(request, user_id)

    def post(self, request: Request, user_id: int):
        return self._update_role(request, user_id)


class AdminUserStatusView(APIView):
    """PUT / PATCH / POST /api/admin/users/<user_id>/status."""

    permission_classes = [IsAuthenticated]

    def _update_status(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل حالة المستخدمين.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        raw_status = str(request.data.get("status") or "").strip().lower()
        mapped_status = {"active": "Active", "suspended": "Suspended", "inactive": "Suspended"}.get(raw_status)
        if not mapped_status:
            return error_response("VALIDATION_ERROR", "حالة الحساب غير صالحة.", status.HTTP_400_BAD_REQUEST)
        target.status = mapped_status
        target.save(update_fields=["status"])
        return success_response({"id": str(target.id), "status": target.status})

    def put(self, request: Request, user_id: int):
        return self._update_status(request, user_id)

    def patch(self, request: Request, user_id: int):
        return self._update_status(request, user_id)

    def post(self, request: Request, user_id: int):
        return self._update_status(request, user_id)


class AdminUserTranscriptView(APIView):
    """GET /api/admin/users/<user_id>/transcript."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض السجل التدريبي.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        enrollments = Enrollment.objects.filter(user=target).select_related("course").order_by("id")
        courses = [
            {
                "courseId": str(e.course_id),
                "courseTitle": e.course.title,
                "enrolledAt": e.enrolled_at,
                "progressPercent": 0,
                "mostWatchedLessonTitle": None,
            }
            for e in enrollments
        ]
        return success_response(
            {
                "userId": str(target.id),
                "userName": target.full_name,
                "totalLearningHours": None,
                "courses": courses,
            }
        )

