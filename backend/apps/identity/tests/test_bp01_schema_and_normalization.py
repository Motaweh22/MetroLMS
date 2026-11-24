"""BP-01 integration tests: SQL Server schema invariants, constraints & OR-DB-04 normalization."""
from __future__ import annotations

import datetime

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.utils import timezone

from apps.identity.models import RolePolicy, User
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
from shared.validators import (
    normalize_email_optional,
    normalize_mime_type,
    normalize_national_id,
    normalize_nfc_preserve_whitespace,
    normalize_nfc_stripped,
    normalize_phone_e164,
    validate_cairo_past_date,
    validate_egypt_phone_e164,
    validate_https_url,
    validate_national_id,
    validate_non_empty_text,
)


class Bp01SqlServerSchemaTests(TestCase):
    """Verify live SQL Server physical schema & constraint enforcement."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_dev = RolePolicy.objects.create(
            role_key="developer",
            default_capabilities_json=["platform.manage"],
            updated_at=now,
            updated_by="system",
        )
        self.role_trainee = RolePolicy.objects.create(
            role_key="trainee",
            default_capabilities_json=[],
            updated_at=now,
            updated_by="system",
        )
        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.metro_line = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]

    def test_54_dbo_feature_tables_and_all_fks_no_action(self) -> None:
        feature_prefixes = (
            "identity_",
            "organization_",
            "governance_",
            "courses_",
            "media_",
            "groups_",
            "learning_",
            "communications_",
        )
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT s.name + '.' + t.name
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            feature_tables = [t for t in tables if t.startswith(tuple(f"dbo.{p}" for p in feature_prefixes))]
            self.assertEqual(len(feature_tables), 57)
            self.assertFalse(any("inpersonattendance" in t.lower() for t in tables))

            cur.execute(
                """
                SELECT COUNT(*)
                FROM sys.foreign_keys fk
                JOIN sys.tables t ON fk.parent_object_id = t.object_id
                WHERE (t.name LIKE 'identity_%' OR t.name LIKE 'organization_%' OR t.name LIKE 'governance_%'
                   OR t.name LIKE 'courses_%' OR t.name LIKE 'media_%' OR t.name LIKE 'groups_%'
                   OR t.name LIKE 'learning_%' OR t.name LIKE 'communications_%')
                  AND fk.delete_referential_action_desc <> 'NO_ACTION'
                """
            )
            self.assertEqual(cur.fetchone()[0], 0)

    def test_phone_e164_sql_check_rejects_invalid_or_trailing_space(self) -> None:
        with self.assertRaises(IntegrityError):
            with connection.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO dbo.identity_user (
                        phone_e164, password_hash, role, status, full_name, national_id,
                        marital_status_id, appointment_date, military_service_status_id,
                        educational_qualification, address, date_of_birth, metro_line_id,
                        created_at, updated_at
                    ) VALUES (
                        N'+201012345678 ', N'pbkdf2_sha256$1$a$b', N'trainee', N'Active',
                        N'أحمد محمد', N'29901010101011', %s, '2020-01-01', %s,
                        N'بكالوريوس', N'القاهرة', '1999-01-01', %s,
                        SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
                    )
                    """,
                    [self.marital.id, self.military.id, self.metro_line.id],
                )

    def test_filtered_unique_indexes_for_developer_and_email(self) -> None:
        User.objects.create_user(
            phone_e164="+201012345671",
            password="Test@1234",
            role=self.role_dev,
            full_name="مطور النظام",
            national_id="29901010101001",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
            email=None,
        )
        # Multiple NULL emails allowed
        User.objects.create_user(
            phone_e164="+201012345672",
            password="Test@1234",
            role=self.role_trainee,
            full_name="متدرب أول",
            national_id="29901010101002",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="دبلوم",
            address="الجيزة",
            date_of_birth=datetime.date(1996, 1, 1),
            metro_line=self.metro_line,
            email=None,
        )
        # Second developer rejected by filtered UNIQUE index
        with self.assertRaises(IntegrityError):
            User.objects.create_user(
                phone_e164="+201012345673",
                password="Test@1234",
                role=self.role_dev,
                full_name="مطور ثان",
                national_id="29901010101003",
                marital_status=self.marital,
                appointment_date=datetime.date(2020, 1, 1),
                military_service_status=self.military,
                educational_qualification="بكالوريوس",
                address="القاهرة",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=self.metro_line,
            )

    def test_user_job_title_composite_fks_enforce_department_scoping(self) -> None:
        user = User.objects.create_user(
            phone_e164="+201012345674",
            password="Test@1234",
            role=self.role_trainee,
            full_name="متدرب ثان",
            national_id="29901010101004",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1997, 1, 1),
            metro_line=self.metro_line,
        )
        dept_a = OrganizationalDepartment.objects.create(name_ar="إدارة التشغيل")
        dept_b = OrganizationalDepartment.objects.create(name_ar="إدارة الصيانة")
        job_b = JobTitle.objects.create(name_ar="مهندس صيانة")
        UserOrganizationalDepartment.objects.create(user=user, department=dept_a)
        DepartmentJobTitle.objects.create(department=dept_b, job_title=job_b)

        # Assigning job_b under dept_a fails composite FK fk_userjobtitle_dept_job
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserJobTitle.objects.create(user=user, department=dept_a, job_title=job_b)

        # Assigning job_b under dept_b (which user doesn't hold) fails fk_userjobtitle_user_dept
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserJobTitle.objects.create(user=user, department=dept_b, job_title=job_b)


class OrDb04NormalizationTests(TestCase):
    """Verify OR-DB-04 field-scoped normalization & validators."""

    def test_normalization_rules(self) -> None:
        self.assertEqual(normalize_nfc_stripped("  أحمد  "), "أحمد")
        self.assertEqual(normalize_nfc_preserve_whitespace("  سطر أول\n  "), "  سطر أول\n  ")
        self.assertIsNone(normalize_email_optional("   "))
        self.assertEqual(normalize_email_optional(" User.Name@Metro.EG "), "User.Name@metro.eg")
        self.assertEqual(normalize_phone_e164(" +201012345678 "), "+201012345678")
        self.assertEqual(normalize_national_id(" 29901010101011 "), "29901010101011")
        self.assertEqual(normalize_mime_type(" Application/PDF "), "application/pdf")

    def test_validators(self) -> None:
        validate_egypt_phone_e164("+201512345678")
        with self.assertRaises(ValidationError):
            validate_egypt_phone_e164("+201312345678")
        validate_national_id("01234567890123")
        with self.assertRaises(ValidationError):
            validate_national_id("123")
        with self.assertRaises(ValidationError):
            validate_non_empty_text("   ")
        validate_https_url("https://drive.google.com/file/d/123")
        with self.assertRaises(ValidationError):
            validate_https_url("http://insecure.example.com")
        with self.assertRaises(ValidationError):
            validate_cairo_past_date(datetime.date(2099, 1, 1))

