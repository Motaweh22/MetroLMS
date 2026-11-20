"""Tests for no-end-date ongoing groups and INV-DOM10-10 deadline removal."""
from __future__ import annotations

import datetime
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.groups.models import GroupRenewalCycle, TrainingGroup
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class GroupNoDeadlineTests(APITestCase):
    """Verify creating ongoing groups without deadline and INV-DOM10-10 deadline removal."""

    def setUp(self) -> None:
        now = timezone.now()
        self.roles = {}
        for rk in ("admin", "trainee"):
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

        self.admin = User.objects.create_user(
            phone_e164="+201077000001",
            password="StrongPass!123",
            role=self.roles["admin"],
            full_name="مدير المجموعات",
            national_id="29501010107001",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1995, 1, 1),
            metro_line=self.line1,
        )

    def test_create_ongoing_group_without_deadline_and_remove_deadline_from_reminder_group(self) -> None:
        self.client.force_authenticate(user=self.admin)

        # 1. Create group without deadlineDateTime
        resp_create = self.client.post(
            "/api/admin/groups",
            {
                "name": "مجموعة مفتوحة بدون موعد",
                "groupType": "regular",
                "autoRenewalEnabled": False,
                "deadlineDateTime": None,
            },
            format="json",
        )
        self.assertEqual(resp_create.status_code, status.HTTP_201_CREATED)
        grp_data = resp_create.data["data"]["group"]
        self.assertIsNone(grp_data["deadlineDateTime"])

        # 2. Reminder group with deadline + autoRenewalEnabled -> DELETE /deadline removes deadline, disables autoRenewal, keeps reminder type, cancels future cycles
        now = timezone.now()
        rem = TrainingGroup.objects.create(
            name="مجموعة تذكيرية بموعد",
            group_type="reminder",
            auto_renewal_enabled=True,
            interval_days=30,
            deadline_datetime=now + timedelta(days=10),
        )
        GroupRenewalCycle.objects.create(
            training_group=rem,
            cycle_code=f"CYC-{rem.id}-01",
            cycle_number=1,
            start_datetime=now - timedelta(days=20),
            deadline_datetime=now + timedelta(days=10),
            cycle_status="Active",
        )
        future_cycle = GroupRenewalCycle.objects.create(
            training_group=rem,
            cycle_code=f"CYC-{rem.id}-02",
            cycle_number=2,
            start_datetime=now + timedelta(days=40),
            deadline_datetime=now + timedelta(days=70),
            cycle_status="Scheduled",
        )

        resp_del = self.client.delete(f"/api/admin/groups/{rem.id}/deadline")
        self.assertEqual(resp_del.status_code, status.HTTP_200_OK)
        rem.refresh_from_db()
        future_cycle.refresh_from_db()
        self.assertIsNone(rem.deadline_datetime)
        self.assertFalse(rem.auto_renewal_enabled)
        self.assertEqual(rem.group_type, "reminder")
        self.assertEqual(future_cycle.cycle_status, "Cancelled")

        # 3. Manual renewal rejected when deadline is missing
        resp_renew = self.client.post(f"/api/admin/groups/{rem.id}/renew")
        self.assertEqual(resp_renew.status_code, status.HTTP_400_BAD_REQUEST)
