"""Admin user lifecycle endpoints (D-01 deletion cascade)."""
from __future__ import annotations

from datetime import date
import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.identity.api.serializers.auth import AuthenticatedUserSerializer
from apps.identity.models import User
from apps.identity.services.auth_service import invalidate_user_sessions
from apps.identity.services.user_deletion_service import UserDeletionError, delete_user_with_d01_cascade
from apps.identity.services.user_overview_service import get_user_courses_and_groups_overview
from apps.learning.models import Enrollment
from apps.organization.models import (
    DepartmentJobTitle,
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
from shared.validators import EGYPT_PHONE_RE, normalize_email_optional, normalize_national_id, normalize_phone_e164


def _safe_pk(value: object) -> int | None:
    if value is None or value == "":
        return None
    s = str(value).strip()
    if s.isdigit():
        return int(s)
    return None


def _normalize_egypt_phone_to_e164(raw_phone: str) -> str:
    """Convert 11-digit Egyptian mobile (01XXXXXXXXX) or 201... into canonical +201XXXXXXXXX."""
    phone = normalize_phone_e164(raw_phone).replace(" ", "").replace("-", "")
    if phone.startswith("01") and len(phone) == 11 and phone.isdigit():
        return f"+2{phone}"
    if phone.startswith("201") and len(phone) == 12 and phone.isdigit():
        return f"+{phone}"
    return phone


def _validate_admin_password(raw_pw: str, *, phone_e164: str = "", full_name: str = "") -> str | None:
    """Validate admin-provisioned password complexity; return Arabic error message or None."""
    if len(raw_pw) < 8:
        return "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."
    if not (any(ch.isupper() for ch in raw_pw) and any(ch.islower() for ch in raw_pw) and any(ch.isdigit() for ch in raw_pw)):
        return "يجب أن تحتوي كلمة المرور على حرف إنجليزي كبير وصغير ورقم واحد على الأقل."
    lower_pw = raw_pw.lower()
    local_phone = phone_e164[2:] if phone_e164.startswith("+2") else phone_e164
    if (local_phone and len(local_phone) >= 6 and local_phone in lower_pw) or (
        full_name and len(full_name.strip()) >= 3 and lower_pw == full_name.strip().lower()
    ):
        return "يجب ألا تتطابق كلمة المرور مع رقم الهاتف أو الاسم."
    try:
        validate_password(raw_pw)
    except ValidationError as exc:
        return "; ".join(exc.messages)
    return None


def _assign_user_department_and_job(
    *,
    user: User,
    dept_name: str,
    job_name: str,
    replace_existing: bool = False,
) -> None:
    """Link User to department and job title while respecting SQL Server composite FKs."""
    if not dept_name:
        return
    dept_obj, _ = OrganizationalDepartment.objects.get_or_create(name_ar=dept_name)
    if replace_existing:
        # Remove dependent UserJobTitle rows before changing UserOrganizationalDepartment (fk_userjobtitle_user_dept)
        UserJobTitle.objects.filter(user=user).delete()
        UserOrganizationalDepartment.objects.filter(user=user).exclude(department=dept_obj).delete()
    UserOrganizationalDepartment.objects.get_or_create(user=user, department=dept_obj)

    if job_name:
        job_obj, _ = JobTitle.objects.get_or_create(
            name_ar=job_name,
            defaults={"department": dept_obj},
        )
        # Ensure fk_userjobtitle_dept_job composite parent exists in organization_departmentjobtitle
        DepartmentJobTitle.objects.get_or_create(department=dept_obj, job_title=job_obj)
        UserJobTitle.objects.get_or_create(user=user, department=dept_obj, job_title=job_obj)


_MARITAL_LABELS_BY_GENDER: dict[str, dict[str, str]] = {
    "male": {
        "single": "أعزب",
        "married": "متزوج",
        "divorced": "مطلّق",
        "widowed": "أرمل",
    },
    "female": {
        "single": "آنسة",
        "married": "متزوجة",
        "divorced": "مطلّقة",
        "widowed": "أرملة",
    },
}


def _normalize_gender(raw_value: object, national_id: str = "") -> str:
    raw = str(raw_value or "").strip().lower()
    if raw in {"female", "f", "أنثى", "انثى"}:
        return "female"
    if raw in {"male", "m", "ذكر"}:
        return "male"
    if len(national_id) == 14 and national_id.isdigit():
        return "female" if int(national_id[12]) % 2 == 0 else "male"
    return "male"


def _gender_label_ar(gender: str | None) -> str:
    return "أنثى" if gender == "female" else "ذكر"


def _format_marital_status_for_gender(marital_obj, gender: str | None) -> str:
    if marital_obj is None:
        return ""
    g = "female" if gender == "female" else "male"
    code = (getattr(marital_obj, "code", "") or "").strip().lower()
    return _MARITAL_LABELS_BY_GENDER.get(g, {}).get(code) or marital_obj.name_ar


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
        user_data["nameEn"] = user.full_name_en or ""
        user_data["role"] = "user" if user.role_id == "trainee" else user.role_id
        user_data["initials"] = user.full_name[:2] if user.full_name else "م"
        user_data["department"] = dept_name
        user_data["jobTitle"] = job_name
        user_data["leadershipTitle"] = user.leadership_title or ""
        user_data["employeeNumber"] = user.employee_number or ""
        user_data["nationalId"] = user.national_id
        user_data["gender"] = user.gender or "male"
        user_data["genderLabel"] = _gender_label_ar(user.gender)
        user_data["dateOfBirth"] = user.date_of_birth.isoformat() if user.date_of_birth else None
        user_data["appointmentDate"] = user.appointment_date.isoformat() if user.appointment_date else None
        user_data["serviceEndDate"] = user.service_end_date.isoformat() if user.service_end_date else None
        user_data["address"] = user.address or ""
        user_data["educationalQualification"] = user.educational_qualification or ""
        user_data["maritalStatus"] = _format_marital_status_for_gender(user.marital_status, user.gender)
        user_data["militaryServiceStatus"] = (
            user.military_service_status.name_ar if user.military_service_status else ""
        )
        user_data["metroLine"] = user.metro_line.name_ar if user.metro_line else ""
        enrolled = Enrollment.objects.filter(user=user, source_grants__isnull=False).distinct().count()
        overview = get_user_courses_and_groups_overview(user)
        completed_count = sum(1 for c in overview["enrolledCourses"] if c.get("isCompleted"))
        from django.db.models import Sum
        from apps.learning.models import LessonProgress

        lp_agg = LessonProgress.objects.filter(course_attempt__enrollment__user=user).aggregate(
            elig=Sum("eligible_viewing_seconds"),
            furth=Sum("furthest_watched_seconds"),
        )
        total_secs = int(lp_agg.get("elig") or 0) or int(lp_agg.get("furth") or 0)
        total_hours = round(total_secs / 3600, 1) if total_secs > 0 else 0
        return success_response(
            {
                "user": user_data,
                "stats": {
                    "totalLearningHours": total_hours,
                    "enrolledCoursesCount": enrolled,
                    "completedCoursesCount": completed_count,
                },
                "overview": overview,
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
                "nameEn": u.full_name_en or "",
                "username": u.phone_e164,
                "phoneE164": u.phone_e164,
                "phone": u.phone_e164,
                "email": u.email or u.phone_e164,
                "role": "user" if u.role_id == "trainee" else u.role_id,
                "status": u.status.lower(),
                "department": dept_map.get(u.id, ""),
                "jobTitle": job_map.get(u.id, ""),
                "leadershipTitle": u.leadership_title or "",
                "employeeNumber": u.employee_number or "",
                "nationalId": u.national_id,
                "gender": u.gender or "male",
                "genderLabel": _gender_label_ar(u.gender),
                "dateOfBirth": u.date_of_birth.isoformat() if u.date_of_birth else None,
                "appointmentDate": u.appointment_date.isoformat() if u.appointment_date else None,
                "serviceEndDate": u.service_end_date.isoformat() if u.service_end_date else None,
                "address": u.address or "",
                "educationalQualification": u.educational_qualification or "",
                "maritalStatusId": u.marital_status_id,
                "maritalStatus": _format_marital_status_for_gender(u.marital_status, u.gender),
                "militaryServiceStatusId": u.military_service_status_id,
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
        raw_password = request.data.get("password")
        password_input = str(raw_password) if raw_password is not None else ""
        raw_role = str(request.data.get("role") or "user").strip()
        role_id = "trainee" if raw_role == "user" else raw_role
        email = request.data.get("email") or None
        raw_status = str(request.data.get("status") or "Active").strip()
        user_status = "Suspended" if raw_status.lower() == "suspended" else "Active"

        if not name or not raw_phone:
            return error_response("VALIDATION_ERROR", "الاسم ورقم الهاتف مطلوبان.", status.HTTP_400_BAD_REQUEST)
        if role_id not in {"super_admin", "admin", "assistant_admin", "lecturer", "trainee"}:
            return error_response("VALIDATION_ERROR", "الدور المحدد غير صالح.", status.HTTP_400_BAD_REQUEST)
        if role_id in {"super_admin", "admin"} and request.user.role_id not in {"developer", "super_admin"}:
            return error_response(
                "PERMISSION_DENIED",
                "إنشاء حسابات مديري النظام أو المدير الأعلى مقتصر على المدير الأعلى أو المطور.",
                status.HTTP_403_FORBIDDEN,
            )

        phone = _normalize_egypt_phone_to_e164(raw_phone)
        if not EGYPT_PHONE_RE.match(phone):
            return error_response("VALIDATION_ERROR", "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً (010/011/012/015).", status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(phone_e164=phone).exists():
            return error_response("CONFLICT", "رقم الهاتف مسجل بالفعل.", status.HTTP_409_CONFLICT)

        if password_input.strip():
            pw_error = _validate_admin_password(password_input, phone_e164=phone, full_name=name)
            if pw_error:
                return error_response("VALIDATION_ERROR", pw_error, status.HTTP_400_BAD_REQUEST)
            password = password_input
        else:
            # Generate unique non-guessable initial password when omitted by API callers
            password = f"M{secrets.token_urlsafe(10)}9a!"

        email = normalize_email_optional(str(email)) if email is not None else None
        if email and User.objects.filter(email=email).exists():
            return error_response("CONFLICT", "البريد الإلكتروني مسجل بالفعل.", status.HTTP_409_CONFLICT)

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
        if service_end_date is not None and service_end_date < appointment_date:
            return error_response(
                "VALIDATION_ERROR",
                "تاريخ انتهاء الخدمة لا يمكن أن يسبق تاريخ التعيين.",
                status.HTTP_400_BAD_REQUEST,
            )

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

        gender = _normalize_gender(request.data.get("gender"), national_id=national_id)
        marital_id = _safe_pk(request.data.get("maritalStatusId") or request.data.get("marital_status_id"))
        military_id = _safe_pk(request.data.get("militaryServiceStatusId") or request.data.get("military_service_status_id"))
        metro_line_id = _safe_pk(request.data.get("metroLineId") or request.data.get("metro_line_id"))

        marital_obj = (
            MaritalStatusCatalog.objects.filter(pk=marital_id).first()
            if marital_id is not None
            else MaritalStatusCatalog.objects.order_by("id").first()
        )
        if military_id is not None:
            military_obj = MilitaryServiceStatusCatalog.objects.filter(pk=military_id).first()
        elif gender == "female":
            military_obj = (
                MilitaryServiceStatusCatalog.objects.filter(code="not_applicable").first()
                or MilitaryServiceStatusCatalog.objects.order_by("id").first()
            )
        else:
            military_obj = MilitaryServiceStatusCatalog.objects.order_by("id").first()
        metro_line_obj = (
            MetroLine.objects.filter(pk=metro_line_id).first()
            if metro_line_id is not None
            else MetroLine.objects.order_by("id").first()
        )
        if marital_obj is None or military_obj is None or metro_line_obj is None:
            return error_response(
                "VALIDATION_ERROR",
                "يرجى تحديد الحالة الاجتماعية والموقف من التجنيد وخط المترو.",
                status.HTTP_400_BAD_REQUEST,
            )

        dept_name = str(request.data.get("department") or "").strip()
        job_name = str(request.data.get("jobTitle") or "").strip()
        leadership_title = str(request.data.get("leadershipTitle") or "").strip() or None
        raw_employee_number = (
            request.data.get("employeeNumber")
            or request.data.get("employee_number")
            or request.data.get("employeeId")
            or ""
        )
        employee_number = str(raw_employee_number).strip()[:50] or None
        if employee_number and User.objects.filter(employee_number=employee_number).exists():
            return error_response("CONFLICT", "الرقم الوظيفي مسجل بالفعل.", status.HTTP_409_CONFLICT)

        raw_name_en = (
            request.data.get("nameEn")
            or request.data.get("fullNameEn")
            or request.data.get("full_name_en")
            or ""
        )
        name_en = str(raw_name_en).strip()[:255] or None

        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    phone_e164=phone,
                    full_name=name,
                    full_name_en=name_en,
                    gender=gender,
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
                    employee_number=employee_number,
                    status=user_status,
                )
                if leadership_title is not None:
                    user.leadership_title = leadership_title
                    user.save(update_fields=["leadership_title"])

                _assign_user_department_and_job(
                    user=user,
                    dept_name=dept_name,
                    job_name=job_name,
                    replace_existing=False,
                )

                from apps.governance.services.governance_service import record_audit_log

                record_audit_log(
                    action="user.created",
                    actor=request.user,
                    target_entity_type="User",
                    target_entity_id=str(user.id),
                    details_snapshot={
                        "role": user.role_id,
                        "department": dept_name,
                        "jobTitle": job_name,
                        "leadershipTitle": user.leadership_title or "",
                    },
                )
        except ValidationError as exc:
            return error_response("VALIDATION_ERROR", "; ".join(exc.messages), status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return error_response("CONFLICT", "تعارض في البيانات الفريدة (رقم الهاتف أو الرقم القومي أو البريد).", status.HTTP_409_CONFLICT)

        return success_response(
            {
                "id": str(user.id),
                "name": user.full_name,
                "nameEn": user.full_name_en or "",
                "username": user.phone_e164,
                "phoneE164": user.phone_e164,
                "phone": user.phone_e164,
                "email": user.email or user.phone_e164,
                "role": "user" if user.role_id == "trainee" else user.role_id,
                "status": user.status.lower(),
                "department": dept_name,
                "jobTitle": job_name,
                "leadershipTitle": user.leadership_title or "",
                "employeeNumber": user.employee_number or "",
                "metroLine": metro_line_obj.name_ar if metro_line_obj else "",
                "initials": user.full_name[:2] if user.full_name else "م",
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminUserDeleteView(APIView):
    """PUT / PATCH / DELETE /api/admin/users/<user_id> — User profile update & D-01 deletion cascade."""

    permission_classes = [IsAuthenticated]

    def _update_user(self, request: Request, user_id: int):
        if request.user.role_id not in {"developer", "super_admin", "admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل بيانات المستخدمين.", status.HTTP_403_FORBIDDEN)
        target = get_visible_user_or_none(request.user, user_id)
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)

        if request.user.role_id == "admin" and target.role_id in {"admin", "super_admin", "developer"}:
            return error_response("PERMISSION_DENIED", "لا يمكنك تعديل حسابات المدراء أو المسؤول الأعلى.", status.HTTP_403_FORBIDDEN)
        if request.user.role_id == "super_admin" and target.role_id in {"super_admin", "developer"} and target.pk != request.user.pk:
            return error_response("PERMISSION_DENIED", "لا يمكنك تعديل حساب مسؤول أعلى آخر.", status.HTTP_403_FORBIDDEN)

        data = request.data if isinstance(request.data, dict) else {}

        if "name" in data or "fullName" in data:
            new_name = str(data.get("name") or data.get("fullName") or "").strip()
            if not new_name:
                return error_response("VALIDATION_ERROR", "الاسم الكامل مطلوب.", status.HTTP_400_BAD_REQUEST)
            target.full_name = new_name

        if "nameEn" in data or "fullNameEn" in data or "full_name_en" in data:
            raw_name_en = (
                data.get("nameEn")
                if "nameEn" in data
                else data.get("fullNameEn")
                if "fullNameEn" in data
                else data.get("full_name_en")
            )
            target.full_name_en = str(raw_name_en or "").strip()[:255] or None

        if "phone" in data or "phoneE164" in data:
            raw_phone = str(data.get("phoneE164") or data.get("phone") or "").strip()
            if not raw_phone:
                return error_response("VALIDATION_ERROR", "رقم الهاتف مطلوب.", status.HTTP_400_BAD_REQUEST)
            phone = _normalize_egypt_phone_to_e164(raw_phone)
            if not EGYPT_PHONE_RE.match(phone):
                return error_response(
                    "VALIDATION_ERROR",
                    "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقماً (010/011/012/015).",
                    status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(phone_e164=phone).exclude(pk=target.pk).exists():
                return error_response("CONFLICT", "رقم الهاتف مسجل بالفعل.", status.HTTP_409_CONFLICT)
            target.phone_e164 = phone

        if "email" in data:
            raw_email = str(data.get("email") or "").strip()
            target.email = raw_email or None

        if "nationalId" in data or "national_id" in data:
            raw_nid = str(data.get("nationalId") or data.get("national_id") or "").strip()
            nid = normalize_national_id(raw_nid)
            if len(nid) != 14 or not nid.isdigit():
                return error_response("VALIDATION_ERROR", "الرقم القومي يجب أن يتكون من 14 رقماً.", status.HTTP_400_BAD_REQUEST)
            if User.objects.filter(national_id=nid).exclude(pk=target.pk).exists():
                return error_response("CONFLICT", "الرقم القومي مسجل بالفعل.", status.HTTP_409_CONFLICT)
            target.national_id = nid

        if "dateOfBirth" in data or "date_of_birth" in data:
            dob = parse_date(str(data.get("dateOfBirth") or data.get("date_of_birth") or "").strip())
            if dob is None or dob >= date.today():
                return error_response("VALIDATION_ERROR", "تاريخ الميلاد يجب أن يكون تاريخاً صحيحاً في الماضي.", status.HTTP_400_BAD_REQUEST)
            target.date_of_birth = dob

        if "appointmentDate" in data or "appointment_date" in data:
            app_date = parse_date(str(data.get("appointmentDate") or data.get("appointment_date") or "").strip())
            if app_date is None:
                return error_response("VALIDATION_ERROR", "تاريخ التعيين غير صالح.", status.HTTP_400_BAD_REQUEST)
            target.appointment_date = app_date

        if "serviceEndDate" in data or "service_end_date" in data:
            raw_end = str(data.get("serviceEndDate") or data.get("service_end_date") or "").strip()
            target.service_end_date = parse_date(raw_end) if raw_end else None

        if "address" in data:
            addr = str(data.get("address") or "").strip()
            if not addr:
                return error_response("VALIDATION_ERROR", "العنوان مطلوب.", status.HTTP_400_BAD_REQUEST)
            target.address = addr

        if "educationalQualification" in data or "educational_qualification" in data:
            qual = str(data.get("educationalQualification") or data.get("educational_qualification") or "").strip()
            if not qual:
                return error_response("VALIDATION_ERROR", "المؤهل الدراسي مطلوب.", status.HTTP_400_BAD_REQUEST)
            target.educational_qualification = qual

        if "gender" in data:
            target.gender = _normalize_gender(data.get("gender"), national_id=target.national_id or "")

        if "maritalStatusId" in data or "marital_status_id" in data:
            raw_mid = data.get("maritalStatusId") or data.get("marital_status_id")
            if raw_mid is not None and raw_mid != "":
                mid = _safe_pk(raw_mid)
                m_obj = MaritalStatusCatalog.objects.filter(pk=mid).first() if mid is not None else None
                if m_obj is None:
                    return error_response("VALIDATION_ERROR", "الحالة الاجتماعية غير صالحة.", status.HTTP_400_BAD_REQUEST)
                target.marital_status = m_obj

        if "militaryServiceStatusId" in data or "military_service_status_id" in data:
            raw_mil = data.get("militaryServiceStatusId") or data.get("military_service_status_id")
            if raw_mil is not None and raw_mil != "":
                mil_id = _safe_pk(raw_mil)
                mil_obj = MilitaryServiceStatusCatalog.objects.filter(pk=mil_id).first() if mil_id is not None else None
                if mil_obj is None:
                    return error_response("VALIDATION_ERROR", "الموقف من التجنيد غير صالح.", status.HTTP_400_BAD_REQUEST)
                target.military_service_status = mil_obj
        elif "gender" in data and target.gender == "female":
            na_obj = MilitaryServiceStatusCatalog.objects.filter(code="not_applicable").first()
            if na_obj is not None:
                target.military_service_status = na_obj

        old_line_id = target.metro_line_id
        old_dept_ids = set(UserOrganizationalDepartment.objects.filter(user=target).values_list("department_id", flat=True))
        old_job_ids = set(target.user_job_titles.values_list("job_title_id", flat=True))

        if "metroLineId" in data or "metro_line_id" in data:
            raw_line = data.get("metroLineId") or data.get("metro_line_id")
            if raw_line is not None and raw_line != "":
                line_id = _safe_pk(raw_line)
                line_obj = MetroLine.objects.filter(pk=line_id).first() if line_id is not None else None
                if line_obj is None:
                    return error_response("VALIDATION_ERROR", "خط المترو غير صالح.", status.HTTP_400_BAD_REQUEST)
                target.metro_line = line_obj

        if "leadershipTitle" in data:
            target.leadership_title = str(data.get("leadershipTitle") or "").strip() or None

        if "employeeNumber" in data or "employee_number" in data or "employeeId" in data:
            raw_emp = (
                data.get("employeeNumber")
                if "employeeNumber" in data
                else data.get("employee_number")
                if "employee_number" in data
                else data.get("employeeId")
            )
            emp_num = str(raw_emp or "").strip()[:50] or None
            if emp_num and User.objects.filter(employee_number=emp_num).exclude(pk=target.pk).exists():
                return error_response("CONFLICT", "الرقم الوظيفي مسجل بالفعل.", status.HTTP_409_CONFLICT)
            target.employee_number = emp_num

        password_changed = False
        if "password" in data and data.get("password") is not None:
            raw_pw = str(data.get("password") or "")
            if raw_pw.strip():
                pw_error = _validate_admin_password(
                    raw_pw,
                    phone_e164=target.phone_e164,
                    full_name=target.full_name,
                )
                if pw_error:
                    return error_response(
                        "VALIDATION_ERROR",
                        pw_error,
                        status.HTTP_400_BAD_REQUEST,
                    )
                target.set_password(raw_pw)
                password_changed = True

        if target.service_end_date is not None and target.appointment_date is not None and target.service_end_date < target.appointment_date:
            return error_response(
                "VALIDATION_ERROR",
                "تاريخ انتهاء الخدمة لا يمكن أن يسبق تاريخ التعيين.",
                status.HTTP_400_BAD_REQUEST,
            )

        try:
            target.full_clean()
            target.save()
        except ValidationError as exc:
            return error_response("VALIDATION_ERROR", "; ".join(exc.messages), status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            return error_response("CONFLICT", "تعارض في البيانات الفريدة (رقم الهاتف أو الرقم القومي أو البريد).", status.HTTP_409_CONFLICT)

        if password_changed and target.id != request.user.id:
            invalidate_user_sessions(target.id)

        if "department" in data or "jobTitle" in data:
            dept_name = str(data.get("department") or "").strip()
            job_name = str(data.get("jobTitle") or "").strip()
            _assign_user_department_and_job(
                user=target,
                dept_name=dept_name,
                job_name=job_name,
                replace_existing=True,
            )

        new_line_id = target.metro_line_id
        new_dept_ids = set(UserOrganizationalDepartment.objects.filter(user=target).values_list("department_id", flat=True))
        new_job_ids = set(target.user_job_titles.values_list("job_title_id", flat=True))
        revoked_courses = []
        if old_line_id != new_line_id or old_dept_ids != new_dept_ids or old_job_ids != new_job_ids:
            from apps.learning.services.learning_service import reconcile_user_enrollments_on_org_change

            revoked_courses = reconcile_user_enrollments_on_org_change(actor=request.user, user=target)

        dept_link = UserOrganizationalDepartment.objects.filter(user=target).select_related("department").first()
        job_link = UserJobTitle.objects.filter(user=target).select_related("job_title", "department").first()
        dept_out = (
            job_link.department.name_ar
            if job_link and job_link.department
            else (dept_link.department.name_ar if dept_link and dept_link.department else "")
        )
        job_out = job_link.job_title.name_ar if job_link and job_link.job_title else ""

        from apps.governance.services.governance_service import record_audit_log

        record_audit_log(
            action="user.updated",
            actor=request.user,
            target_entity_type="User",
            target_entity_id=str(target.id),
            details_snapshot={
                "updatedFields": sorted(str(k) for k in data.keys() if k != "password"),
                "passwordChanged": password_changed,
                "leadershipTitle": target.leadership_title or "",
            },
        )

        return success_response(
            {
                "id": str(target.id),
                "name": target.full_name,
                "nameEn": target.full_name_en or "",
                "username": target.phone_e164,
                "phoneE164": target.phone_e164,
                "phone": target.phone_e164,
                "email": target.email or target.phone_e164,
                "role": "user" if target.role_id == "trainee" else target.role_id,
                "status": target.status.lower(),
                "department": dept_out,
                "jobTitle": job_out,
                "leadershipTitle": target.leadership_title or "",
                "employeeNumber": target.employee_number or "",
                "nationalId": target.national_id,
                "gender": target.gender or "male",
                "genderLabel": _gender_label_ar(target.gender),
                "dateOfBirth": target.date_of_birth.isoformat() if target.date_of_birth else None,
                "appointmentDate": target.appointment_date.isoformat() if target.appointment_date else None,
                "serviceEndDate": target.service_end_date.isoformat() if target.service_end_date else None,
                "address": target.address or "",
                "educationalQualification": target.educational_qualification or "",
                "maritalStatusId": target.marital_status_id,
                "maritalStatus": _format_marital_status_for_gender(target.marital_status, target.gender),
                "militaryServiceStatusId": target.military_service_status_id,
                "militaryServiceStatus": (
                    target.military_service_status.name_ar if target.military_service_status else ""
                ),
                "metroLine": target.metro_line.name_ar if target.metro_line else "",
                "revokedCourseTitles": [c.title for c in revoked_courses],
                "initials": target.full_name[:2] if target.full_name else "م",
            }
        )

    def put(self, request: Request, user_id: int):
        return self._update_user(request, user_id)

    def patch(self, request: Request, user_id: int):
        return self._update_user(request, user_id)

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
        if target.id == request.user.id:
            return error_response("SELF_MUTATION_BLOCKED", "لا يمكنك تعديل دور حسابك الشخصي.", status.HTTP_403_FORBIDDEN)
        if target.role_id == "developer":
            return error_response("PERMISSION_DENIED", "لا يمكن تعديل دور حساب المطور.", status.HTTP_403_FORBIDDEN)
        if target.role_id == "super_admin" and request.user.role_id != "developer":
            return error_response("PERMISSION_DENIED", "تعديل دور المدير الأعلى مقصور على المطور فقط (INV-R6).", status.HTTP_403_FORBIDDEN)
        if target.role_id == "admin" and request.user.role_id not in {"developer", "super_admin"}:
            return error_response("PERMISSION_DENIED", "تعديل دور مدير النظام مقصور على المدير الأعلى أو المطور (INV-R3).", status.HTTP_403_FORBIDDEN)
        raw_role = str(request.data.get("role") or request.data.get("newRole") or "").strip()
        mapped_role = "trainee" if raw_role == "user" else raw_role
        if mapped_role not in {"super_admin", "admin", "assistant_admin", "lecturer", "trainee"}:
            return error_response("VALIDATION_ERROR", "الدور المحدد غير صالح.", status.HTTP_400_BAD_REQUEST)
        if mapped_role in {"super_admin", "admin"} and request.user.role_id not in {"developer", "super_admin"}:
            return error_response("PERMISSION_DENIED", "منح دور المدير أو المدير الأعلى مقتصر على المدير الأعلى أو المطور.", status.HTTP_403_FORBIDDEN)
        old_role = target.role_id
        target.role_id = mapped_role
        target.save(update_fields=["role"])
        from apps.governance.services.governance_service import record_audit_log

        record_audit_log(
            action="user.role_changed",
            actor=request.user,
            target_entity_type="User",
            target_entity_id=str(target.id),
            details_snapshot={"oldRole": old_role, "newRole": mapped_role},
        )
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
        if target.id == request.user.id:
            return error_response("SELF_MUTATION_BLOCKED", "لا يمكنك إيقاف أو تعديل حالة حسابك الشخصي.", status.HTTP_403_FORBIDDEN)
        if target.role_id == "developer":
            return error_response("PERMISSION_DENIED", "لا يمكن تعديل حالة حساب المطور.", status.HTTP_403_FORBIDDEN)
        if target.role_id == "super_admin" and request.user.role_id != "developer":
            return error_response("PERMISSION_DENIED", "تعديل حالة المدير الأعلى مقصور على المطور فقط (INV-R6).", status.HTTP_403_FORBIDDEN)
        if target.role_id == "admin" and request.user.role_id not in {"developer", "super_admin"}:
            return error_response("PERMISSION_DENIED", "تعديل حالة مدير النظام مقصور على المدير الأعلى أو المطور (INV-R3).", status.HTTP_403_FORBIDDEN)
        raw_status = str(request.data.get("status") or "").strip().lower()
        mapped_status = {"active": "Active", "suspended": "Suspended", "inactive": "Suspended"}.get(raw_status)
        if not mapped_status:
            return error_response("VALIDATION_ERROR", "حالة الحساب غير صالحة.", status.HTTP_400_BAD_REQUEST)
        old_status = target.status
        target.status = mapped_status
        target.save(update_fields=["status"])
        if mapped_status == "Suspended":
            invalidate_user_sessions(target.id)
        from apps.governance.services.governance_service import record_audit_log

        record_audit_log(
            action="user.status_changed",
            actor=request.user,
            target_entity_type="User",
            target_entity_id=str(target.id),
            details_snapshot={"oldStatus": old_status, "newStatus": mapped_status},
        )
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

        target = (
            User.objects.select_related("marital_status", "military_service_status", "metro_line")
            .filter(pk=target.pk)
            .first()
            or target
        )
        dept_link = (
            UserOrganizationalDepartment.objects.filter(user=target)
            .select_related("department")
            .order_by("id")
            .first()
        )
        job_link = (
            UserJobTitle.objects.filter(user=target)
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

        from apps.learning.models import CourseAttempt
        from apps.learning.services.learning_service import compute_course_progress

        enrollments = (
            Enrollment.objects.filter(user=target, source_grants__isnull=False)
            .select_related("course")
            .distinct()
            .order_by("id")
        )
        courses = []
        total_attempts = 0
        completed_attempts = 0
        completed_courses = 0
        progress_sum = 0

        for e in enrollments:
            attempts_qs = CourseAttempt.objects.filter(enrollment=e).order_by("-id")
            att_list = []
            best_pct = 0
            for att in attempts_qs:
                prog = compute_course_progress(att)
                pct = int(prog.get("percentage", 0) or 0)
                if pct > best_pct:
                    best_pct = pct
                total_attempts += 1
                if pct >= 100:
                    completed_attempts += 1
                att_list.append(
                    {
                        "id": str(att.id),
                        "courseId": str(e.course_id),
                        "userId": str(target.id),
                        "attemptNumber": att.id,
                        "status": "completed" if pct >= 100 else ("in_progress" if pct > 0 else "not_started"),
                        "progressPercent": pct,
                        "startedAt": e.enrolled_at.isoformat() if e.enrolled_at else None,
                    }
                )
            if best_pct >= 100:
                completed_courses += 1
            progress_sum += best_pct
            c_status = "completed" if best_pct >= 100 else ("in_progress" if best_pct > 0 else "not_started")
            courses.append(
                {
                    "courseId": str(e.course_id),
                    "courseTitle": e.course.title,
                    "title": e.course.title,
                    "description": e.course.description or "",
                    "level": "تذكيرية" if e.course.course_type == "reminder" else "مبتدئ",
                    "progressPercent": best_pct,
                    "status": c_status,
                    "enrolledAt": e.enrolled_at.isoformat() if e.enrolled_at else "",
                    "lastActivityAt": None,
                    "timesOpened": None,
                    "mostWatchedLessonTitle": None,
                    "mostWatchedCount": None,
                    "attemptsCount": len(att_list),
                    "attempts": att_list,
                }
            )

        enrolled_count = len(courses)
        avg_rate = round(progress_sum / enrolled_count) if enrolled_count > 0 else 0

        user_payload = {
            "id": str(target.id),
            "name": target.full_name,
            "nameEn": target.full_name_en or "",
            "username": target.phone_e164,
            "phoneE164": target.phone_e164,
            "phone": target.phone_e164,
            "email": target.email or target.phone_e164,
            "role": "user" if target.role_id == "trainee" else target.role_id,
            "status": target.status.lower(),
            "department": dept_name,
            "jobTitle": job_name,
            "leadershipTitle": target.leadership_title or "",
            "employeeNumber": target.employee_number or "",
            "nationalId": target.national_id,
            "gender": target.gender or "male",
            "genderLabel": _gender_label_ar(target.gender),
            "dateOfBirth": target.date_of_birth.isoformat() if target.date_of_birth else None,
            "appointmentDate": target.appointment_date.isoformat() if target.appointment_date else None,
            "serviceEndDate": target.service_end_date.isoformat() if target.service_end_date else None,
            "address": target.address or "",
            "educationalQualification": target.educational_qualification or "",
            "maritalStatus": _format_marital_status_for_gender(target.marital_status, target.gender),
            "militaryServiceStatus": (
                target.military_service_status.name_ar if target.military_service_status else ""
            ),
            "metroLine": target.metro_line.name_ar if target.metro_line else "",
            "metroLineId": target.metro_line_id,
            "maritalStatusId": target.marital_status_id,
            "militaryServiceStatusId": target.military_service_status_id,
            "createdAt": target.created_at.isoformat() if target.created_at else None,
            "lastLogin": target.last_login.isoformat() if target.last_login else None,
        }

        return success_response(
            {
                "userId": str(target.id),
                "userName": target.full_name,
                "totalLearningHours": None,
                "user": user_payload,
                "metrics": {
                    "totalLearningHours": None,
                    "averageCompletionRate": avg_rate,
                    "enrolledCoursesCount": enrolled_count,
                    "completedCoursesCount": completed_courses,
                    "totalAttemptsCount": total_attempts,
                    "completedAttemptsCount": completed_attempts,
                },
                "courses": courses,
            }
        )


class PublicUserOverviewView(APIView):
    """GET /api/users/<user_id>/overview — Non-sensitive public member profile + courses/groups overview."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, user_id: int):
        target = User.objects.select_related("metro_line").filter(pk=user_id).first()
        if target is None:
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)
        if target.role_id == "developer" and request.user.role_id != "developer":
            return error_response("RESOURCE_NOT_FOUND", "المستخدم غير موجود.", status.HTTP_404_NOT_FOUND)

        if target.id != request.user.id:
            actor_role = request.user.role_id
            if actor_role == "trainee":
                # Trainees may inspect public instructor overviews (course/group lecturers)
                # but must never inspect peer trainees' or administrative accounts' profiles.
                if target.role_id != "lecturer":
                    return error_response(
                        "PERMISSION_DENIED",
                        "ليس لديك صلاحية استعراض ملف هذا المستخدم.",
                        status.HTTP_403_FORBIDDEN,
                    )
            elif actor_role == "lecturer":
                if target.role_id in {"super_admin", "admin", "assistant_admin"}:
                    return error_response(
                        "PERMISSION_DENIED",
                        "ليس لديك صلاحية استعراض ملفات مسؤولي النظام.",
                        status.HTTP_403_FORBIDDEN,
                    )
                if target.role_id == "trainee":
                    from django.db.models import Q
                    from apps.groups.models import GroupMembership

                    teaches_trainee = Enrollment.objects.filter(
                        user=target,
                        source_grants__isnull=False,
                    ).filter(
                        Q(course__primary_lecturer=request.user)
                        | Q(course__assistant_lecturers__user=request.user)
                    ).exists()
                    shares_supervised_group = GroupMembership.objects.filter(
                        user=target,
                    ).filter(
                        Q(training_group__assistant_assignments__user=request.user)
                        | Q(training_group__renewal_cycles__course_assignments__course__primary_lecturer=request.user)
                    ).exists()
                    if not teaches_trainee and not shares_supervised_group:
                        return error_response(
                            "PERMISSION_DENIED",
                            "ليس لديك صلاحية استعراض ملف متدرب خارج دوراتك ومجموعاتك.",
                            status.HTTP_403_FORBIDDEN,
                        )
            elif actor_role not in {"developer", "super_admin", "admin", "assistant_admin"}:
                return error_response(
                    "PERMISSION_DENIED",
                    "ليس لديك صلاحية استعراض ملف هذا المستخدم.",
                    status.HTTP_403_FORBIDDEN,
                )

        dept_link = (
            UserOrganizationalDepartment.objects.filter(user=target)
            .select_related("department")
            .order_by("id")
            .first()
        )
        job_link = (
            UserJobTitle.objects.filter(user=target)
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

        overview = get_user_courses_and_groups_overview(target)
        return success_response(
            {
                "user": {
                    "id": str(target.id),
                    "name": target.full_name,
                    "initials": target.full_name[:2] if target.full_name else "م",
                    "role": "user" if target.role_id == "trainee" else target.role_id,
                    "status": target.status.lower(),
                    "department": dept_name,
                    "jobTitle": job_name,
                    "metroLine": target.metro_line.name_ar if target.metro_line else "",
                },
                "overview": overview,
            }
        )

