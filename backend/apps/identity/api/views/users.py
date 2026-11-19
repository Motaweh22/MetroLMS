"""Admin user lifecycle endpoints (D-01 deletion cascade)."""
from __future__ import annotations

from datetime import date

from django.core.exceptions import ValidationError
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.identity.api.serializers.auth import AuthenticatedUserSerializer
from apps.identity.models import User
from apps.identity.services.user_deletion_service import UserDeletionError, delete_user_with_d01_cascade
from apps.learning.models import Enrollment
from apps.organization.models import (
    JobTitle,
    MaritalStatusCatalog,
    MetroLine,
    MilitaryServiceStatusCatalog,
    OrganizationalDepartment,
    UserJobTitle,
    UserOrganizationalDepartment,
)
from shared.api import error_response, success_response
from shared.permissions import get_visible_user_or_none
from shared.validators import normalize_national_id, normalize_phone_e164


class ProfileView(APIView):
    """GET /api/profile — Authenticated user profile & learning summary."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        user = (
            User.objects.select_related("marital_status", "military_service_status", "metro_line")
            .filter(pk=request.user.pk)
            .first()
            or request.user
        )
        dept_link = (
            UserOrganizationalDepartment.objects.filter(user=user)
            .select_related("department")
            .order_by("id")
            .first()
        )
        job_link = (
            UserJobTitle.objects.filter(user=user)
            .select_related("job_title", "department")
            .order_by("id")
            .first()
        )
        dept_name = (
            job_link.department.name_ar
            if job_link and job_link.department
            else (dept_link.department.name_ar if dept_link and dept_link.department else "")
        )
        job_name = job_link.job_title.name_ar if job_link and job_link.job_title else ""

        user_data = AuthenticatedUserSerializer(user).data
        user_data["name"] = user.full_name
        user_data["role"] = "user" if user.role_id == "trainee" else user.role_id
        user_data["initials"] = user.full_name[:2] if user.full_name else "م"
        user_data["department"] = dept_name
        user_data["jobTitle"] = job_name
        user_data["nationalId"] = user.national_id
        user_data["dateOfBirth"] = user.date_of_birth.isoformat() if user.date_of_birth else None
        user_data["appointmentDate"] = user.appointment_date.isoformat() if user.appointment_date else None
        user_data["serviceEndDate"] = user.service_end_date.isoformat() if user.service_end_date else None
        user_data["address"] = user.address or ""
        user_data["educationalQualification"] = user.educational_qualification or ""
        user_data["maritalStatus"] = user.marital_status.name_ar if user.marital_status else ""
        user_data["militaryServiceStatus"] = (
            user.military_service_status.name_ar if user.military_service_status else ""
        )
        user_data["metroLine"] = user.metro_line.name_ar if user.metro_line else ""
        enrolled = Enrollment.objects.filter(user=user).count()
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
        qs = User.objects.select_related("marital_status", "military_service_status", "metro_line").all().order_by("id")
        if request.user.role_id != "developer":
            qs = qs.exclude(role_id="developer")
        role_filter = request.query_params.get("role")
        if role_filter:
            mapped = "trainee" if role_filter == "user" else role_filter
            qs = qs.filter(role_id=mapped)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        user_list = list(qs)
        user_ids = [u.id for u in user_list]
        dept_map: dict[int, str] = {}
        for link in (
            UserOrganizationalDepartment.objects.filter(user_id__in=user_ids)
            .select_related("department")
            .order_by("id")
        ):
            if link.user_id not in dept_map and link.department is not None:
                dept_map[link.user_id] = link.department.name_ar
        job_map: dict[int, str] = {}
        for jlink in (
            UserJobTitle.objects.filter(user_id__in=user_ids)
            .select_related("job_title", "department")
            .order_by("id")
        ):
            if jlink.user_id not in job_map and jlink.job_title is not None:
                job_map[jlink.user_id] = jlink.job_title.name_ar
            if jlink.user_id not in dept_map and jlink.department is not None:
                dept_map[jlink.user_id] = jlink.department.name_ar

        users = [
            {
                "id": str(u.id),
                "name": u.full_name,
                "username": u.phone_e164,
                "phoneE164": u.phone_e164,
                "phone": u.phone_e164,
                "email": u.email or u.phone_e164,
                "role": "user" if u.role_id == "trainee" else u.role_id,
                "status": u.status.lower(),
                "department": dept_map.get(u.id, ""),
                "jobTitle": job_map.get(u.id, ""),
                "nationalId": u.national_id,
                "dateOfBirth": u.date_of_birth.isoformat() if u.date_of_birth else None,
                "appointmentDate": u.appointment_date.isoformat() if u.appointment_date else None,
                "serviceEndDate": u.service_end_date.isoformat() if u.service_end_date else None,
                "address": u.address or "",
                "educationalQualification": u.educational_qualification or "",
                "maritalStatus": u.marital_status.name_ar if u.marital_status else "",
                "militaryServiceStatus": (
                    u.military_service_status.name_ar if u.military_service_status else ""
                ),
                "metroLine": u.metro_line.name_ar if u.metro_line else "",
                "createdAt": u.created_at.isoformat() if u.created_at else None,
                "initials": u.full_name[:2] if u.full_name else "م",
            }
            for u in user_list
        ]
        return success_response(users)

    def post(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إنشاء مستخدمين.", status.HTTP_403_FORBIDDEN)
        name = str(request.data.get("name") or request.data.get("fullName") or "").strip()
        raw_phone = str(request.data.get("phoneE164") or request.data.get("phone") or "").strip()
        password = str(request.data.get("password") or "Metro@12345")
        raw_role = str(request.data.get("role") or "user").strip()
        role_id = "trainee" if raw_role == "user" else raw_role
        email = request.data.get("email") or None
        raw_status = str(request.data.get("status") or "Active").strip()
        user_status = "Suspended" if raw_status.lower() == "suspended" else "Active"

        if not name or not raw_phone:
            return error_response("VALIDATION_ERROR", "الاسم ورقم الهاتف مطلوبان.", status.HTTP_400_BAD_REQUEST)
        if role_id not in {"super_admin", "admin", "assistant_admin", "lecturer", "trainee"}:
            return error_response("VALIDATION_ERROR", "الدور المحدد غير صالح.", status.HTTP_400_BAD_REQUEST)

        phone = normalize_phone_e164(raw_phone)
        if phone.startswith("01") and len(phone) == 11 and phone.isdigit():
            phone = f"+2{phone}"
        if User.objects.filter(phone_e164=phone).exists():
            return error_response("CONFLICT", "رقم الهاتف مسجل بالفعل.", status.HTTP_409_CONFLICT)

        raw_national_id = str(request.data.get("nationalId") or request.data.get("national_id") or "").strip()
        if not raw_national_id:
            return error_response("VALIDATION_ERROR", "الرقم القومي مطلوب (14 رقماً).", status.HTTP_400_BAD_REQUEST)
        national_id = normalize_national_id(raw_national_id)
        if len(national_id) != 14 or not national_id.isdigit():
            return error_response("VALIDATION_ERROR", "الرقم القومي يجب أن يتكون من 14 رقماً.", status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(national_id=national_id).exists():
            return error_response("CONFLICT", "الرقم القومي مسجل بالفعل.", status.HTTP_409_CONFLICT)

        dob = parse_date(str(request.data.get("dateOfBirth") or request.data.get("date_of_birth") or "").strip())
        if dob is None or dob >= date.today():
            return error_response("VALIDATION_ERROR", "تاريخ الميلاد مطلوب ويجب أن يكون في الماضي.", status.HTTP_400_BAD_REQUEST)

        appointment_date = parse_date(
            str(request.data.get("appointmentDate") or request.data.get("appointment_date") or "").strip()
        )
        if appointment_date is None:
            return error_response("VALIDATION_ERROR", "تاريخ التعيين مطلوب.", status.HTTP_400_BAD_REQUEST)

        raw_service_end = str(request.data.get("serviceEndDate") or request.data.get("service_end_date") or "").strip()
        service_end_date = parse_date(raw_service_end) if raw_service_end else None

        address = str(request.data.get("address") or "").strip()
        educational_qualification = str(
            request.data.get("educationalQualification") or request.data.get("educational_qualification") or ""
        ).strip()
        if not address or not educational_qualification:
            return error_response(
                "VALIDATION_ERROR",
                "العنوان والمؤهل الدراسي مطلوبان.",
                status.HTTP_400_BAD_REQUEST,
            )

        marital_id = request.data.get("maritalStatusId") or request.data.get("marital_status_id")
        military_id = request.data.get("militaryServiceStatusId") or request.data.get("military_service_status_id")
        metro_line_id = request.data.get("metroLineId") or request.data.get("metro_line_id")

        marital_obj = (
            MaritalStatusCatalog.objects.filter(pk=marital_id).first()
            if marital_id
            else MaritalStatusCatalog.objects.order_by("id").first()
        )
        military_obj = (
            MilitaryServiceStatusCatalog.objects.filter(pk=military_id).first()
            if military_id
            else MilitaryServiceStatusCatalog.objects.order_by("id").first()
        )
        metro_line_obj = (
            MetroLine.objects.filter(pk=metro_line_id).first()
            if metro_line_id
            else MetroLine.objects.order_by("id").first()
        )
        if marital_obj is None or military_obj is None or metro_line_obj is None:
            return error_response(
                "VALIDATION_ERROR",
                "يرجى تحديد الحالة الاجتماعية والموقف من التجنيد وخط المترو.",
                status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.create_user(
                phone_e164=phone,
                full_name=name,
                national_id=national_id,
                marital_status=marital_obj,
                appointment_date=appointment_date,
                military_service_status=military_obj,
                educational_qualification=educational_qualification,
                address=address,
                date_of_birth=dob,
                service_end_date=service_end_date,
                metro_line=metro_line_obj,
                role_id=role_id,
                password=password,
                email=email,
                status=user_status,
            )
        except ValidationError as exc:
            return error_response("VALIDATION_ERROR", "; ".join(exc.messages), status.HTTP_400_BAD_REQUEST)

        dept_name = str(request.data.get("department") or "").strip()
        job_name = str(request.data.get("jobTitle") or "").strip()
        dept_obj = None
        if dept_name:
            dept_obj, _ = OrganizationalDepartment.objects.get_or_create(name_ar=dept_name)
            UserOrganizationalDepartment.objects.get_or_create(user=user, department=dept_obj)
        if job_name and dept_obj is not None:
            job_obj, _ = JobTitle.objects.get_or_create(name_ar=job_name)
            UserJobTitle.objects.get_or_create(user=user, department=dept_obj, job_title=job_obj)

        return success_response(
            {
                "id": str(user.id),
                "name": user.full_name,
                "phoneE164": user.phone_e164,
                "email": user.email or user.phone_e164,
                "role": "user" if user.role_id == "trainee" else user.role_id,
                "status": user.status.lower(),
                "department": dept_name,
                "jobTitle": job_name,
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

