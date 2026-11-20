"""Tests for User Profile overview & non-sensitive Public User Overview endpoint."""
from __future__ import annotations

import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.courses.services.course_service import create_course
from apps.groups.models import GroupAssistantAssignment, GroupMembership, GroupRenewalCycle, TrainingGroup
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class UserPublicOverviewTests(APITestCase):
    """Verify /api/profile overview and /api/users/<id>/overview privacy & counts."""

    def setUp(self) -> None:
        now = timezone.now()
        self.roles = {}
        for rk in ("developer", "admin", "lecturer", "trainee"):
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

        def make_user(phone: str, nid: str, rk: str, name: str) -> User:
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
                address="القاهرة - عنوان سري",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=self.line1,
            )

        self.dev = make_user("+201088000001", "29501010108001", "developer", "المطور")
        self.lecturer = make_user("+201088000002", "29501010108002", "lecturer", "المحاضر أحمد")
        self.trainee = make_user("+201088000003", "29501010108003", "trainee", "المتدرب علي")

        self.course = create_course(
            actor=self.lecturer,
            title="مقرر السلامة المهنية",
            description="وصف المقرر",
            course_type="main",
            primary_lecturer=self.lecturer,
        )

        self.group = TrainingGroup.objects.create(
            name="مجموعة صيانة الخط الأول",
            group_type="regular",
            auto_renewal_enabled=True,
            interval_days=90,
        )
        GroupAssistantAssignment.objects.create(
            training_group=self.group,
            user=self.lecturer,
            assignment_role="supervisor",
        )
        for num in (1, 2, 3):
            GroupRenewalCycle.objects.create(
                training_group=self.group,
                cycle_code=f"CYC-{self.group.id}-{num:02d}",
                cycle_number=num,
                start_datetime=now,
                cycle_status="Completed" if num < 3 else "Active",
            )
        GroupMembership.objects.create(
            training_group=self.group,
            user=self.trainee,
            joined_at=now,
        )

    def test_any_authenticated_user_can_view_public_overview_without_sensitive_fields(self) -> None:
        self.client.force_authenticate(user=self.trainee)
        resp = self.client.get(f"/api/users/{self.lecturer.id}/overview")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        payload = resp.data["data"]
        user_info = payload["user"]
        self.assertEqual(user_info["name"], "المحاضر أحمد")
        # Sensitive fields must NOT be present
        for sensitive_key in ("nationalId", "phone", "phoneE164", "email", "address", "dateOfBirth"):
            self.assertNotIn(sensitive_key, user_info)

        ov = payload["overview"]
        self.assertEqual(len(ov["assignedOrCreatedCourses"]), 1)
        self.assertEqual(ov["assignedOrCreatedCourses"][0]["title"], "مقرر السلامة المهنية")
        self.assertIn("primary_lecturer", ov["assignedOrCreatedCourses"][0]["roles"])
        self.assertIn("created", ov["assignedOrCreatedCourses"][0]["roles"])

        self.assertEqual(len(ov["supervisedGroups"]), 1)
        self.assertEqual(ov["supervisedGroups"][0]["name"], "مجموعة صيانة الخط الأول")
        self.assertEqual(ov["supervisedGroups"][0]["supervisionCount"], 3)

        # INV-R8: developer hidden from non-developer
        resp_dev = self.client.get(f"/api/users/{self.dev.id}/overview")
        self.assertEqual(resp_dev.status_code, status.HTTP_404_NOT_FOUND)

    def test_profile_endpoint_includes_overview(self) -> None:
        self.client.force_authenticate(user=self.trainee)
        resp = self.client.get("/api/profile")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ov = resp.data["data"]["overview"]
        self.assertEqual(len(ov["memberGroups"]), 1)
        self.assertEqual(ov["memberGroups"][0]["name"], "مجموعة صيانة الخط الأول")
