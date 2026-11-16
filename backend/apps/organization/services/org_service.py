"""Organization & HR domain services (OR-DB-04, D-OWNER-REV-10, D-OWNER-REV-17)."""
from __future__ import annotations

from django.db import IntegrityError
from django.utils import timezone

from apps.identity.models import User
from apps.organization.models import (
    DepartmentJobTitle,
    DepartmentTrack,
    HistoricalServiceTrainingRecord,
    JobTitle,
    OrganizationalDepartment,
    UserJobTitle,
    UserOrganizationalDepartment,
)
from shared.validators import (
    normalize_nfc_preserve_whitespace,
    normalize_nfc_stripped,
    validate_non_empty_text,
)


class OrganizationConflictError(Exception):
    """Raised on D-OWNER-REV-10 / D-OWNER-REV-17 / duplicate constraint conflict (HTTP 409)."""


def link_department_job_title(department: OrganizationalDepartment, job_title: JobTitle) -> DepartmentJobTitle:
    """Associate a JobTitle with an OrganizationalDepartment."""
    obj, _ = DepartmentJobTitle.objects.get_or_create(department=department, job_title=job_title)
    return obj


def assign_user_department(user: User, department: OrganizationalDepartment) -> UserOrganizationalDepartment:
    """Assign an OrganizationalDepartment to a User."""
    obj, _ = UserOrganizationalDepartment.objects.get_or_create(user=user, department=department)
    return obj


def assign_user_job_title(
    user: User,
    department: OrganizationalDepartment,
    job_title: JobTitle,
) -> UserJobTitle:
    """Assign a department-scoped JobTitle to a User (D-OWNER-REV-17)."""
    try:
        obj, _ = UserJobTitle.objects.get_or_create(user=user, department=department, job_title=job_title)
        return obj
    except IntegrityError as exc:
        raise OrganizationConflictError(
            "لا يمكن إسناد المسمى الوظيفي للمستخدم خارج نطاق الأقسام المعين عليها."
        ) from exc


def delete_catalog_record(instance) -> None:
    """Delete a catalog row enforcing D-OWNER-REV-10 ON DELETE NO ACTION guard."""
    try:
        instance.delete()
    except IntegrityError as exc:
        raise OrganizationConflictError(
            "لا يمكن حذف هذا السجل المرجعي لارتباطه ببيانات مستخدمين أو دورات قائمة."
        ) from exc


def create_historical_training_record(
    *,
    user: User,
    course_name: str,
    providing_organization: str,
    completion_date=None,
    certificate_info_or_notes: str | None = None,
) -> HistoricalServiceTrainingRecord:
    """Create a HistoricalServiceTrainingRecord with OR-DB-04 normalization."""
    norm_course = normalize_nfc_stripped(course_name)
    norm_org = normalize_nfc_stripped(providing_organization)
    validate_non_empty_text(norm_course)
    validate_non_empty_text(norm_org)
    norm_notes = (
        normalize_nfc_preserve_whitespace(certificate_info_or_notes)
        if certificate_info_or_notes is not None
        else None
    )
    return HistoricalServiceTrainingRecord.objects.create(
        user=user,
        course_name=norm_course,
        providing_organization=norm_org,
        completion_date=completion_date,
        certificate_info_or_notes=norm_notes,
    )


def upsert_department_track(
    *,
    department_code: str,
    allowed_tracks: list[str],
    actor_id: str,
) -> DepartmentTrack:
    """Create or update a DepartmentTrack (Option A single PK)."""
    norm_code = normalize_nfc_stripped(department_code)
    validate_non_empty_text(norm_code)
    norm_tracks = [normalize_nfc_stripped(t) for t in allowed_tracks if t and t.strip()]
    track, _ = DepartmentTrack.objects.update_or_create(
        department_code=norm_code,
        defaults={
            "allowed_tracks_json": list(dict.fromkeys(norm_tracks)),
            "updated_at": timezone.now(),
            "updated_by": str(actor_id),
        },
    )
    return track

