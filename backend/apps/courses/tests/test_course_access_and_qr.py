"""Tests for Course access_mode (all_trainees / targeted / hidden), direct bulk enrollment, and QR settings."""
from __future__ import annotations

import datetime
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.courses.services.course_service import (
    create_course,
    decide_course_review,
    is_course_visible_to_trainee,
    save_course_draft,
    submit_course_for_review,
)
from apps.identity.models import RolePolicy, User
from apps.learning.models import Enrollment
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class CourseAccessAndQrTests(APITestCase):
    """End-to-end verification of course visibility modes, direct enrollment, and QR flow."""

    def setUp(self) -> None:
        now = timezone.now()
        self.roles = {}
        for rk in ("admin", "lecturer", "trainee"):
            self.roles[rk], _ = RolePolicy.objects.get_or_create(
                role_key=rk,
                defaults={
                    "default_capabilities_json": sorted(ROLE_DEFAULT_CAPABILITIES[rk]),
                    "updated_at": now,
                    "updated_by": "system",
                },
            )
        self.marital, _ = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})
        self.military, _ = MilitaryServiceStatusCatalog.objects.get_or_create(
            code="completed", defaults={"name_ar": "أنهى الخدمة"}
        )
        self.line1, _ = MetroLine.objects.get_or_create(name_ar="الخط الأول")
        self.line2, _ = MetroLine.objects.get_or_create(name_ar="الخط الثاني")

        def make_user(phone: str, nid: str, rk: str, name: str, line: MetroLine) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="StrongPass!123",
                role=self.roles[rk],
                full_name=name,
                national_id=nid,
                marital_status=self.marital,
                appointment_date=datetime.date(2020, 1, 1),
                military_service_status=self.military,
                educational_qualification="بكالوريوس",
                address="القاهرة",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=line,
            )

        self.admin = make_user("+201099000001", "29501010109001", "admin", "مدير النظام", self.line1)
        self.lecturer = make_user("+201099000002", "29501010109002", "lecturer", "المحاضر", self.line1)
        self.trainee1 = make_user("+201099000003", "29501010109003", "trainee", "متدرب ١", self.line1)
        self.trainee2 = make_user("+201099000004", "29501010109004", "trainee", "متدرب ٢", self.line2)

        self.course = create_course(
            actor=self.lecturer,
            title="دورة اختبار الوصول",
            description="وصف دورة اختبار الوصول",
            course_type="main",
            primary_lecturer=self.lecturer,
        )
        save_course_draft(
            actor=self.lecturer,
            course=self.course,
            title_snapshot="دورة اختبار الوصول",
            modules_payload=[
                {"title": "الوحدة الأولى", "order": 1, "items": [{"title": "الدرس الأول", "itemType": "video", "order": 1}]}
            ],
        )
        sub = submit_course_for_review(actor=self.lecturer, course=self.course)
        decide_course_review(reviewer=self.admin, submission=sub, decision="approve")
        self.course.refresh_from_db()

    def test_access_modes_all_trainees_and_hidden_and_direct_enrollment(self) -> None:
        # 1. all_trainees -> visible to both trainees regardless of org profile
        self.course.access_mode = "all_trainees"
        self.course.save(update_fields=["access_mode", "updated_at"])
        self.assertTrue(is_course_visible_to_trainee(self.trainee1, self.course))
        self.assertTrue(is_course_visible_to_trainee(self.trainee2, self.course))

        # 2. hidden -> hidden from catalog & CourseCatalogDetailView returns 403 for non-enrolled trainee
        self.course.access_mode = "hidden"
        self.course.save(update_fields=["access_mode", "updated_at"])
        self.assertFalse(is_course_visible_to_trainee(self.trainee1, self.course))

        self.client.force_authenticate(user=self.trainee1)
        resp_denied = self.client.get(f"/api/courses/{self.course.id}")
        self.assertEqual(resp_denied.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Direct bulk-add by lecturer grants access even when hidden
        self.client.force_authenticate(user=self.lecturer)
        resp_add = self.client.post(
            f"/api/courses/{self.course.id}/enrollments/bulk-add",
            {"userIds": [self.trainee1.id]},
            format="json",
        )
        self.assertEqual(resp_add.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_add.data["data"]["addedCount"], 1)
        self.assertTrue(is_course_visible_to_trainee(self.trainee1, self.course))

        self.client.force_authenticate(user=self.trainee1)
        resp_allowed = self.client.get(f"/api/courses/{self.course.id}")
        self.assertEqual(resp_allowed.status_code, status.HTTP_200_OK)

        # 4. Revoking direct grant removes access again
        self.client.force_authenticate(user=self.lecturer)
        resp_del = self.client.delete(f"/api/courses/{self.course.id}/enrollments/{self.trainee1.id}/direct-grant")
        self.assertEqual(resp_del.status_code, status.HTTP_200_OK)
        self.assertFalse(resp_del.data["data"]["hasActiveAccess"])
        self.assertFalse(is_course_visible_to_trainee(self.trainee1, self.course))

    def test_course_qr_settings_rotate_expiry_and_auto_enroll(self) -> None:
        self.course.access_mode = "hidden"
        self.course.save(update_fields=["access_mode", "updated_at"])

        self.client.force_authenticate(user=self.lecturer)
        resp_get = self.client.get(f"/api/lecturer/courses/{self.course.id}/qr-settings")
        self.assertEqual(resp_get.status_code, status.HTTP_200_OK)
        old_token = resp_get.data["data"]["qrSettings"]["token"]

        # Enable auto_enroll
        resp_patch = self.client.patch(
            f"/api/lecturer/courses/{self.course.id}/qr-settings",
            {"isEnabled": True, "qrMode": "auto_enroll"},
            format="json",
        )
        self.assertEqual(resp_patch.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_patch.data["data"]["qrSettings"]["qrMode"], "auto_enroll")

        # Rotate token -> old token becomes invalid
        resp_rot = self.client.post(f"/api/lecturer/courses/{self.course.id}/qr-settings/rotate")
        self.assertEqual(resp_rot.status_code, status.HTTP_200_OK)
        new_token = resp_rot.data["data"]["qrSettings"]["token"]
        self.assertNotEqual(old_token, new_token)

        self.client.force_authenticate(user=self.trainee2)
        self.assertEqual(self.client.get(f"/api/courses/join/{old_token}/info").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(f"/api/courses/join/{new_token}/info").status_code, status.HTTP_200_OK)

        # Join via QR -> auto enrolls trainee2
        resp_join = self.client.post("/api/courses/join-by-qr", {"token": new_token}, format="json")
        self.assertEqual(resp_join.status_code, status.HTTP_200_OK)
        self.assertTrue(resp_join.data["data"]["enrolled"])
        self.assertTrue(
            Enrollment.objects.filter(
                user=self.trainee2,
                course=self.course,
                source_grants__source_type="qr_code",
            ).exists()
        )

        # Expired QR -> 403
        self.client.force_authenticate(user=self.lecturer)
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        self.client.patch(
            f"/api/lecturer/courses/{self.course.id}/qr-settings",
            {"expiresAt": past},
            format="json",
        )
        self.client.force_authenticate(user=self.trainee1)
        resp_exp = self.client.post("/api/courses/join-by-qr", {"token": new_token}, format="json")
        self.assertEqual(resp_exp.status_code, status.HTTP_403_FORBIDDEN)
