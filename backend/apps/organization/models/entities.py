"""Organization, HR catalogs & curriculum track models (10 active entities)."""
from __future__ import annotations

from django.db import models
from django.db.models import Q

from shared.validators import validate_non_empty_text


class OrganizationalDepartment(models.Model):
    """Admin-managed Organizational Department catalog."""

    id = models.BigAutoField(primary_key=True)
    name_ar = models.CharField(max_length=150, unique=True)
    name_en = models.CharField(max_length=150, null=True, blank=True)

    class Meta:
        db_table = "organization_organizationaldepartment"

    def __str__(self) -> str:
        return self.name_ar


class JobTitle(models.Model):
    """Admin-managed Job Title catalog (optionally scoped to an OrganizationalDepartment)."""

    id = models.BigAutoField(primary_key=True)
    name_ar = models.CharField(max_length=150, unique=True)
    name_en = models.CharField(max_length=150, null=True, blank=True)
    department = models.ForeignKey(
        OrganizationalDepartment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        db_column="department_id",
        related_name="job_titles",
    )

    class Meta:
        db_table = "organization_jobtitle"

    def __str__(self) -> str:
        return self.name_ar


class MetroLine(models.Model):
    """Admin-managed Cairo Metro Line catalog."""

    id = models.BigAutoField(primary_key=True)
    name_ar = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "organization_metroline"

    def __str__(self) -> str:
        return self.name_ar


class LeadershipTitleCatalog(models.Model):
    """Admin-managed Leadership / Supervisory Title catalog."""

    id = models.BigAutoField(primary_key=True)
    name_ar = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "organization_leadershiptitlecatalog"

    def __str__(self) -> str:
        return self.name_ar


class MaritalStatusCatalog(models.Model):
    """Admin-managed Marital Status catalog."""

    id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=32, unique=True)
    name_ar = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "organization_maritalstatuscatalog"

    def __str__(self) -> str:
        return self.name_ar


class MilitaryServiceStatusCatalog(models.Model):
    """Admin-managed Military Service Status catalog."""

    id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=32, unique=True)
    name_ar = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = "organization_militaryservicestatuscatalog"

    def __str__(self) -> str:
        return self.name_ar


class HistoricalServiceTrainingRecord(models.Model):
    """Pre-LMS historical service training record (0..N per User/Tombstone; Option A)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="historical_service_training_records",
    )
    tombstone = models.ForeignKey(
        "identity.DeletedUserTombstone",
        null=True,
        blank=True,
        on_delete=models.DO_NOTHING,
        db_column="tombstone_id",
        related_name="historical_service_training_records",
    )
    course_name = models.CharField(max_length=255, validators=[validate_non_empty_text])
    providing_organization = models.CharField(max_length=255, validators=[validate_non_empty_text])
    completion_date = models.DateField(null=True, blank=True)
    certificate_info_or_notes = models.CharField(max_length=1000, null=True, blank=True)

    class Meta:
        db_table = "organization_historicalservicetrainingrecord"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (Q(user__isnull=False) & Q(tombstone__isnull=True))
                    | (Q(user__isnull=True) & Q(tombstone__isnull=False))
                ),
                name="ck_histtrain_owner_xor",
            ),
        ]


class DepartmentTrack(models.Model):
    """Curriculum governance department track mapping (Option A single PK)."""

    department_code = models.CharField(primary_key=True, max_length=64)
    allowed_tracks_json = models.JSONField(default=list)
    updated_at = models.DateTimeField()
    updated_by = models.CharField(max_length=64)

    class Meta:
        db_table = "organization_departmenttrack"

    def __str__(self) -> str:
        return self.department_code


class UserOrganizationalDepartment(models.Model):
    """M:N association between User and OrganizationalDepartment."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_column="user_id",
        related_name="user_departments",
    )
    department = models.ForeignKey(
        OrganizationalDepartment,
        on_delete=models.DO_NOTHING,
        db_column="department_id",
        related_name="department_users",
    )

    class Meta:
        db_table = "organization_userorganizationaldepartment"
        indexes = [
            models.Index(fields=["department"], name="ix_userorgdept_dept"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "department"],
                name="uq_userorgdept_user_dept",
            ),
        ]


class DepartmentJobTitle(models.Model):
    """M:N association between OrganizationalDepartment and JobTitle."""

    id = models.BigAutoField(primary_key=True)
    department = models.ForeignKey(
        OrganizationalDepartment,
        on_delete=models.DO_NOTHING,
        db_column="department_id",
        related_name="department_job_titles",
    )
    job_title = models.ForeignKey(
        JobTitle,
        on_delete=models.DO_NOTHING,
        db_column="job_title_id",
        related_name="job_title_departments",
    )

    class Meta:
        db_table = "organization_departmentjobtitle"
        indexes = [
            models.Index(fields=["job_title"], name="ix_deptjobtitle_jobtitle"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "job_title"],
                name="uq_deptjobtitle_dept_job",
            ),
        ]


class UserJobTitle(models.Model):
    """Department-scoped User ↔ JobTitle association enforced via composite FKs."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        "identity.User",
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        db_column="user_id",
        related_name="user_job_titles",
    )
    department = models.ForeignKey(
        OrganizationalDepartment,
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        db_column="department_id",
        related_name="user_job_titles",
    )
    job_title = models.ForeignKey(
        JobTitle,
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        db_column="job_title_id",
        related_name="user_job_titles",
    )

    class Meta:
        db_table = "organization_userjobtitle"
        indexes = [
            models.Index(fields=["user", "job_title"], name="ix_userjobtitle_user_job"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "department", "job_title"],
                name="uq_userjobtitle_user_dept_job",
            ),
        ]

