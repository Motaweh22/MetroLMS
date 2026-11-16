"""BP-04 integration tests: Organization catalogs, DepartmentTrack Option A, D-OWNER-REV-10/17 & OR-DB-04."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.identity.models import RolePolicy, User
from apps.organization.models import (
    DepartmentTrack,
    HistoricalServiceTrainingRecord,
    JobTitle,
    MaritalStatusCatalog,
    MetroLine,
    MilitaryServiceStatusCatalog,
    OrganizationalDepartment,
)
from apps.organization.services.org_service import link_department_job_title
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp04OrganizationAndHrTests(TestCase):
    """Verify Organization & HR endpoints, D-OWNER-REV-10/17, INV-R8 404, and OR-DB-04."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_admin = RolePolicy.objects.create(
            role_key="admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["admin"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_dev = RolePolicy.objects.create(
            role_key="developer",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["developer"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_trainee = RolePolicy.objects.create(
            role_key="trainee",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["trainee"]),
            updated_at=now,
            updated_by="system",
        )
        self.marital = MaritalStatusCatalog.objects.create(code="single", name_ar="أعزب")
        self.military = MilitaryServiceStatusCatalog.objects.create(code="completed", name_ar="أنهى الخدمة")
        self.metro_line = MetroLine.objects.create(name_ar="الخط الأول")

        self.admin = User.objects.create_user(
            phone_e164="+201000000101",
            password="TestPassword@123",
            role=self.role_admin,
            full_name="مدير النظام",
            national_id="29501010102001",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )
        self.developer = User.objects.create_user(
            phone_e164="+201000000100",
            password="TestPassword@123",
            role=self.role_dev,
            full_name="مطور النظام",
            national_id="29501010102000",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )
        self.trainee = User.objects.create_user(
            phone_e164="+201000000102",
            password="TestPassword@123",
            role=self.role_trainee,
            full_name="متدرب",
            national_id="29501010102002",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )

    def _admin_client(self) -> Client:
        c = Client()
        res = c.post(
            "/api/auth/login",
            data={"phone_e164": self.admin.phone_e164, "password": "TestPassword@123"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return c

    def test_department_track_option_a_and_catalog_in_use_409_guard(self) -> None:
        c = self._admin_client()
        track_res = c.post(
            "/api/admin/department-tracks",
            data={"departmentCode": "  OPS_01  ", "allowedTracks": ["TRK-001", "TRK-002"]},
            content_type="application/json",
        )
        self.assertEqual(track_res.status_code, 201)
        self.assertTrue(DepartmentTrack.objects.filter(department_code="OPS_01").exists())

        # D-OWNER-REV-10: Deleting MetroLine referenced by active Users returns 409
        del_line = c.delete(f"/api/admin/organization/metro-lines/{self.metro_line.id}")
        self.assertEqual(del_line.status_code, 409)
        self.assertEqual(del_line.json()["code"], "CATALOG_IN_USE")

    def test_d_owner_rev_17_department_scoped_job_title_and_historical_training(self) -> None:
        c = self._admin_client()
        dept_a = OrganizationalDepartment.objects.create(name_ar="التشغيل")
        dept_b = OrganizationalDepartment.objects.create(name_ar="الصيانة")
        job_b = JobTitle.objects.create(name_ar="مهندس صيانة")
        link_department_job_title(dept_b, job_b)

        # Assign dept_a to trainee
        self.assertEqual(
            c.post(
                f"/api/admin/users/{self.trainee.id}/organization",
                data={"departmentId": dept_a.id},
                content_type="application/json",
            ).status_code,
            201,
        )
        # Assigning job_b under dept_b (not assigned to trainee) -> 409
        bad_job = c.post(
            f"/api/admin/users/{self.trainee.id}/organization",
            data={"departmentId": dept_b.id, "jobTitleId": job_b.id},
            content_type="application/json",
        )
        self.assertEqual(bad_job.status_code, 409)

        # HistoricalServiceTrainingRecord preserves notes whitespace (OR-DB-04 Condition A)
        hist_res = c.post(
            f"/api/admin/users/{self.trainee.id}/historical-training",
            data={
                "courseName": "  السلامة المهنية  ",
                "providingOrganization": "  معهد التدريب  ",
                "certificateInfoOrNotes": "  شهادة رقم 101  ",
            },
            content_type="application/json",
        )
        self.assertEqual(hist_res.status_code, 201)
        rec = HistoricalServiceTrainingRecord.objects.get(user=self.trainee)
        self.assertEqual(rec.course_name, "السلامة المهنية")
        self.assertEqual(rec.certificate_info_or_notes, "  شهادة رقم 101  ")

        # INV-R8: Admin querying developer historical training gets 404
        self.assertEqual(c.get(f"/api/admin/users/{self.developer.id}/historical-training").status_code, 404)

