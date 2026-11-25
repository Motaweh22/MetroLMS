"""BP-04 integration tests: Organization catalogs, DepartmentTrack Option A, D-OWNER-REV-10/17 & OR-DB-04."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.identity.models import RolePolicy, User
from apps.organization.models import (
    DepartmentJobTitle,
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
        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.metro_line = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]

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

    def test_admin_user_creation_and_update_sync_department_job_title(self) -> None:
        c = self._admin_client()
        dept = OrganizationalDepartment.objects.create(name_ar="إدارة التدريب الهندسي")
        job = JobTitle.objects.create(name_ar="أخصائي تدريب متقدم", department=dept)

        # Even without manual DepartmentJobTitle row beforehand, POST /api/admin/users creates user + links FK safely
        create_res = c.post(
            "/api/admin/users",
            data={
                "name": "م. خالد محسن",
                "phone": "01055566677",
                "gender": "male",
                "nationalId": "29501010109988",
                "dateOfBirth": "1995-01-01",
                "appointmentDate": "2021-01-01",
                "address": "القاهرة",
                "educationalQualification": "بكالوريوس هندسة",
                "department": dept.name_ar,
                "jobTitle": job.name_ar,
                "role": "user",
                "status": "active",
            },
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        new_uid = int(create_res.json()["data"]["id"])

        # Updating user to a different department + jobTitle + 11-digit phone also succeeds cleanly
        new_dept = OrganizationalDepartment.objects.create(name_ar="إدارة الإشارات")
        update_res = c.put(
            f"/api/admin/users/{new_uid}",
            data={
                "phone": "01122233344",
                "department": new_dept.name_ar,
                "jobTitle": "مهندس إشارات أول",
            },
            content_type="application/json",
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["data"]["phoneE164"], "+201122233344")
        self.assertEqual(update_res.json()["data"]["department"], new_dept.name_ar)
        self.assertEqual(update_res.json()["data"]["jobTitle"], "مهندس إشارات أول")

        # Invalid phone length (10 digits) is rejected cleanly with 400
        bad_phone_res = c.put(
            f"/api/admin/users/{new_uid}",
            data={"phone": "0112223334"},
            content_type="application/json",
        )
        self.assertEqual(bad_phone_res.status_code, 400)

        # Weak password (<8 chars, missing complexity, or containing user phone) rejected with 400
        for bad_pw in ("123456", "abcdefgh", "Pass01122233344"):
            bad_pw_res = c.put(
                f"/api/admin/users/{new_uid}",
                data={"password": bad_pw},
                content_type="application/json",
            )
            self.assertEqual(bad_pw_res.status_code, 400)

        # Strong admin-assigned password succeeds and invalidates active user sessions
        from apps.identity.models import ServerSession

        new_user = User.objects.get(pk=new_uid)
        t_client = Client()
        t_client.force_login(new_user)
        self.assertGreaterEqual(ServerSession.objects.filter(user=new_user).count(), 1)

        good_pw_res = c.put(
            f"/api/admin/users/{new_uid}",
            data={"password": "MetroStrong@2026"},
            content_type="application/json",
        )
        self.assertEqual(good_pw_res.status_code, 200)
        self.assertEqual(ServerSession.objects.filter(user=new_user).count(), 0)

    def test_leadership_title_catalog_crud_rename_cascade_and_in_use_guard(self) -> None:
        c = self._admin_client()

        create_res = c.post(
            "/api/admin/organization/leadership-titles",
            data={"nameAr": "نائب رئيس قطاع", "nameEn": "Deputy Sector Head"},
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        lt_id = create_res.json()["data"]["leadershipTitle"]["id"]

        list_res = c.get("/api/admin/organization/leadership-titles")
        self.assertEqual(list_res.status_code, 200)
        names = [item["nameAr"] for item in list_res.json()["data"]["leadershipTitles"]]
        self.assertIn("نائب رئيس قطاع", names)

        # Assign to trainee
        self.trainee.leadership_title = "نائب رئيس قطاع"
        self.trainee.save(update_fields=["leadership_title"])

        # Deleting while assigned to a User returns 409 CATALOG_IN_USE
        del_blocked = c.delete(f"/api/admin/organization/leadership-titles/{lt_id}")
        self.assertEqual(del_blocked.status_code, 409)
        self.assertEqual(del_blocked.json()["code"], "CATALOG_IN_USE")

        # Renaming cascades to assigned users
        upd_res = c.put(
            f"/api/admin/organization/leadership-titles/{lt_id}",
            data={"nameAr": "مساعد رئيس قطاع", "nameEn": "Assistant Sector Head"},
            content_type="application/json",
        )
        self.assertEqual(upd_res.status_code, 200)
        self.trainee.refresh_from_db()
        self.assertEqual(self.trainee.leadership_title, "مساعد رئيس قطاع")

        # Unassign and delete cleanly
        self.trainee.leadership_title = None
        self.trainee.save(update_fields=["leadership_title"])
        del_ok = c.delete(f"/api/admin/organization/leadership-titles/{lt_id}")
        self.assertEqual(del_ok.status_code, 200)

    def test_create_and_update_job_title_links_department_atomically(self) -> None:
        c = self._admin_client()
        dept1 = OrganizationalDepartment.objects.create(name_ar="إدارة الصيانة الميكانيكية")
        dept2 = OrganizationalDepartment.objects.create(name_ar="إدارة التشغيل المركزي")

        create_res = c.post(
            "/api/admin/organization/job-titles",
            data={"nameAr": "فني صيانة أول", "nameEn": "Senior Maintenance Tech", "departmentId": dept1.id},
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        jt_data = create_res.json()["data"]["jobTitle"]
        self.assertEqual(jt_data["departmentId"], dept1.id)
        jt_id = int(jt_data["id"])
        self.assertTrue(DepartmentJobTitle.objects.filter(department=dept1, job_title_id=jt_id).exists())

        upd_res = c.patch(
            f"/api/admin/organization/job-titles/{jt_id}",
            data={"departmentId": dept2.id},
            content_type="application/json",
        )
        self.assertEqual(upd_res.status_code, 200)
        self.assertTrue(DepartmentJobTitle.objects.filter(department=dept2, job_title_id=jt_id).exists())

        # Deleting a JobTitle linked only via DepartmentJobTitle (0 users, 0 courses) succeeds cleanly
        del_jt_res = c.delete(f"/api/admin/organization/job-titles/{jt_id}")
        self.assertEqual(del_jt_res.status_code, 200)
        self.assertFalse(DepartmentJobTitle.objects.filter(job_title_id=jt_id).exists())

    def test_unassigned_department_lifecycle_and_dependency_resolution(self) -> None:
        from apps.courses.models import Course, CourseAudienceDepartment
        from apps.organization.models import UserJobTitle, UserOrganizationalDepartment

        c = self._admin_client()
        dept_old = OrganizationalDepartment.objects.create(name_ar="إدارة التذاكر القديمة")
        dept_new = OrganizationalDepartment.objects.create(name_ar="إدارة التحصيل الإلكتروني")
        scoped_job = JobTitle.objects.create(name_ar="صراف تذاكر أول", department=dept_old)
        link_department_job_title(dept_old, scoped_job)

        # 1. Create a user without any department ("بدون قطاع")
        no_dept_res = c.post(
            "/api/admin/users",
            data={
                "name": "موظف بدون قطاع",
                "phone": "01077788899",
                "gender": "male",
                "nationalId": "29501010104455",
                "dateOfBirth": "1995-01-01",
                "appointmentDate": "2022-01-01",
                "address": "القاهرة",
                "educationalQualification": "دبلوم",
                "department": "",
                "jobTitle": "",
                "role": "user",
                "status": "active",
            },
            content_type="application/json",
        )
        self.assertEqual(no_dept_res.status_code, 201)
        no_dept_uid = int(no_dept_res.json()["data"]["id"])
        self.assertEqual(no_dept_res.json()["data"]["department"], "")
        self.assertFalse(UserOrganizationalDepartment.objects.filter(user_id=no_dept_uid).exists())

        # 2. Assign two trainees + developer + super_admin + targeted course to dept_old
        role_super = RolePolicy.objects.create(
            role_key="super_admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["super_admin"]),
            updated_at=timezone.now(),
            updated_by="system",
        )
        super_user = User.objects.create_user(
            phone_e164="+201000000199",
            password="TestPassword@123",
            role=role_super,
            full_name="مسؤول أعلى",
            national_id="29501010102999",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )
        trainee_b = User.objects.create_user(
            phone_e164="+201000000188",
            password="TestPassword@123",
            role=self.role_trainee,
            full_name="متدرب منقول",
            national_id="29501010102888",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.metro_line,
        )
        for u in (self.trainee, trainee_b, super_user, self.developer):
            UserOrganizationalDepartment.objects.get_or_create(user=u, department=dept_old)
        UserJobTitle.objects.get_or_create(user=self.trainee, department=dept_old, job_title=scoped_job)

        course = Course.objects.create(
            title="سلامة التشغيل",
            course_type="main",
            primary_lecturer=self.admin,
            created_by_user=self.admin,
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
        CourseAudienceDepartment.objects.create(course=course, department=dept_old)

        # Clear self.trainee via PUT /api/admin/users/<id> with department=""
        clear_res = c.put(
            f"/api/admin/users/{self.trainee.id}",
            data={"department": "", "jobTitle": ""},
            content_type="application/json",
        )
        self.assertEqual(clear_res.status_code, 200)
        self.assertEqual(clear_res.json()["data"]["department"], "")
        self.assertFalse(UserOrganizationalDepartment.objects.filter(user=self.trainee).exists())
        self.assertFalse(UserJobTitle.objects.filter(user=self.trainee).exists())

        # Re-attach trainee to test modal dependency inspection + resolution
        UserOrganizationalDepartment.objects.get_or_create(user=self.trainee, department=dept_old)
        UserJobTitle.objects.get_or_create(user=self.trainee, department=dept_old, job_title=scoped_job)

        # List includes usageSummary (excluding developer from non-dev actor)
        depts_res = c.get("/api/admin/organization/departments")
        self.assertEqual(depts_res.status_code, 200)
        dept_old_dto = next(d for d in depts_res.json()["data"]["departments"] if d["id"] == dept_old.id)
        self.assertEqual(dept_old_dto["usageSummary"]["usersCount"], 3)
        self.assertEqual(dept_old_dto["usageSummary"]["jobTitlesCount"], 1)
        self.assertEqual(dept_old_dto["usageSummary"]["coursesCount"], 1)

        # Dependency inspection hides developer (INV-R8) and flags super_admin as canModify=False
        deps_res = c.get(f"/api/admin/organization/departments/{dept_old.id}/dependencies")
        self.assertEqual(deps_res.status_code, 200)
        deps_data = deps_res.json()["data"]
        returned_ids = {u["id"] for u in deps_data["users"]}
        self.assertNotIn(str(self.developer.id), returned_ids)
        super_entry = next(u for u in deps_data["users"] if u["id"] == str(super_user.id))
        self.assertFalse(super_entry["canModify"])
        self.assertTrue(deps_data["hasProtectedUsers"])

        # Admin attempting to move super_admin gets 403
        forbidden_res = c.post(
            f"/api/admin/organization/departments/{dept_old.id}/resolve-dependencies",
            data={"userAction": "unassign", "userIds": [super_user.id]},
            content_type="application/json",
        )
        self.assertEqual(forbidden_res.status_code, 403)

        # Detach developer/super_admin as developer actor so full resolve+delete succeeds
        UserOrganizationalDepartment.objects.filter(
            user__in=[self.developer, super_user], department=dept_old
        ).delete()

        # Partial unassign ("بدون قطاع") on self.trainee keeps dept_old alive
        partial_res = c.post(
            f"/api/admin/organization/departments/{dept_old.id}/resolve-dependencies",
            data={"userAction": "unassign", "userIds": [self.trainee.id], "deleteAfter": False},
            content_type="application/json",
        )
        self.assertEqual(partial_res.status_code, 200)
        self.assertFalse(partial_res.json()["data"]["deleted"])
        self.assertFalse(UserOrganizationalDepartment.objects.filter(user=self.trainee).exists())

        # Transfer remaining trainee_b + make job title global + remove course + deleteAfter=True
        final_res = c.post(
            f"/api/admin/organization/departments/{dept_old.id}/resolve-dependencies",
            data={
                "userAction": "transfer",
                "userIds": [trainee_b.id],
                "targetId": dept_new.id,
                "jobTitleAction": "make_global",
                "jobTitleIds": [scoped_job.id],
                "courseAction": "remove",
                "courseIds": [course.id],
                "deleteAfter": True,
            },
            content_type="application/json",
        )
        self.assertEqual(final_res.status_code, 200)
        self.assertTrue(final_res.json()["data"]["deleted"])
        self.assertFalse(OrganizationalDepartment.objects.filter(pk=dept_old.id).exists())
        self.assertTrue(UserOrganizationalDepartment.objects.filter(user=trainee_b, department=dept_new).exists())
        scoped_job.refresh_from_db()
        self.assertIsNone(scoped_job.department)

        # Metro line forbids "unassign" (NOT NULL constraint) with 400
        bad_line = c.post(
            f"/api/admin/organization/metro-lines/{self.metro_line.id}/resolve-dependencies",
            data={"userAction": "unassign", "userIds": [trainee_b.id]},
            content_type="application/json",
        )
        self.assertEqual(bad_line.status_code, 400)



