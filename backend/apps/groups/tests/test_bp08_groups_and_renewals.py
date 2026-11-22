"""BP-08 integration tests: TrainingGroups, Assistants, Renewals, QR Join & Resources."""
from __future__ import annotations

import datetime
import hashlib
from datetime import timedelta

from django.test import Client, TestCase
from django.utils import timezone

from apps.groups.models import (
    GroupAssistantAssignment,
    GroupJoinRequest,
    GroupMembership,
    GroupQrCode,
    GroupRenewalCycle,
    GroupResource,
    TrainingGroup,
)
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp08GroupsAndRenewalsTests(TestCase):
    """Verify BP-08: group creation, assistant assignment, deadline removal, renewals, QR join, and HTTPS resources."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_admin = RolePolicy.objects.create(
            role_key="admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["admin"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_assistant = RolePolicy.objects.create(
            role_key="assistant_admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["assistant_admin"]),
            updated_at=now,
            updated_by="system",
        )
        self.role_lecturer = RolePolicy.objects.create(
            role_key="lecturer",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["lecturer"]),
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

        def make_user(phone: str, nid: str, role_policy: RolePolicy, name: str) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="TestPassword@123",
                role=role_policy,
                full_name=name,
                national_id=nid,
                marital_status=self.marital,
                appointment_date=datetime.date(2020, 1, 1),
                military_service_status=self.military,
                educational_qualification="بكالوريوس",
                address="القاهرة",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=self.metro_line,
            )

        self.admin = make_user("+201000000101", "29001011234561", self.role_admin, "مسؤول التدريب")
        self.assistant = make_user("+201000000102", "29001011234562", self.role_assistant, "مساعد إداري")
        self.lecturer = make_user("+201000000103", "29001011234563", self.role_lecturer, "محاضر المجموعة")
        self.trainee = make_user("+201000000104", "29001011234564", self.role_trainee, "متدرب أول")

    def test_create_groups_assistants_and_deadline_removal(self) -> None:
        client = Client()
        client.force_login(self.admin)

        # Create regular group
        resp = client.post(
            "/api/admin/groups",
            data={"name": "مجموعة الإشارات", "groupType": "regular"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        reg_group_id = resp.json()["data"]["group"]["id"]
        self.assertEqual(resp.json()["data"]["initialCycle"]["cycleCode"], f"CYC-{reg_group_id}-01")

        # Create reminder group with auto-renewal
        future_deadline = (timezone.now() + timedelta(days=30)).isoformat()
        resp_rem = client.post(
            "/api/admin/groups",
            data={
                "name": "مجموعة السلامة الدورية",
                "groupType": "reminder",
                "autoRenewalEnabled": True,
                "intervalDays": 30,
                "deadlineDateTime": future_deadline,
            },
            content_type="application/json",
        )
        self.assertEqual(resp_rem.status_code, 201)
        rem_group_id = resp_rem.json()["data"]["group"]["id"]

        # Create a future Scheduled cycle to verify INV-DOM10-10 cancellation
        GroupRenewalCycle.objects.create(
            training_group_id=rem_group_id,
            cycle_code=f"CYC-{rem_group_id}-02",
            cycle_number=2,
            start_datetime=timezone.now() + timedelta(days=31),
            deadline_datetime=timezone.now() + timedelta(days=61),
            cycle_status="Scheduled",
        )

        # API-REC-02b: Assign assistant
        assign_resp = client.post(
            f"/api/groups/{rem_group_id}/assistants",
            data={"userId": self.assistant.id, "assignmentRole": "assistant_admin"},
            content_type="application/json",
        )
        self.assertEqual(assign_resp.status_code, 201)

        # Duplicate assignment returns 409
        dup_assign = client.post(
            f"/api/groups/{rem_group_id}/assistants",
            data={"userId": self.assistant.id, "assignmentRole": "assistant_admin"},
            content_type="application/json",
        )
        self.assertEqual(dup_assign.status_code, 409)

        # API-REC-02a: List assistants
        list_resp = client.get(f"/api/groups/{rem_group_id}/assistants")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(len(list_resp.json()["data"]["assistants"]), 1)

        # API-REC-02c: Remove assistant
        del_resp = client.delete(f"/api/groups/{rem_group_id}/assistants/{self.assistant.id}")
        self.assertEqual(del_resp.status_code, 200)
        self.assertEqual(GroupAssistantAssignment.objects.filter(training_group_id=rem_group_id).count(), 0)

        # INV-DOM10-10 Option A: Remove deadline
        rm_deadline = client.delete(f"/api/admin/groups/{rem_group_id}/deadline")
        self.assertEqual(rm_deadline.status_code, 200)
        grp = TrainingGroup.objects.get(pk=rem_group_id)
        self.assertEqual(grp.group_type, "reminder")
        self.assertFalse(grp.auto_renewal_enabled)
        self.assertIsNone(grp.deadline_datetime)
        self.assertIsNone(grp.next_scheduled_renewal_date)
        future_cycle = GroupRenewalCycle.objects.get(cycle_code=f"CYC-{rem_group_id}-02")
        self.assertEqual(future_cycle.cycle_status, "Cancelled")

    def test_qr_regeneration_join_requests_and_resubmission(self) -> None:
        client_admin = Client()
        client_admin.force_login(self.admin)
        group_resp = client_admin.post(
            "/api/admin/groups",
            data={"name": "مجموعة التشغيل", "groupType": "regular"},
            content_type="application/json",
        )
        group_id = group_resp.json()["data"]["group"]["id"]

        # Regenerate QR (TR-C3-01 Option B & WP55-PT-04 SHA-256 hash only)
        qr_resp_1 = client_admin.post(f"/api/admin/groups/{group_id}/qr/regenerate")
        self.assertEqual(qr_resp_1.status_code, 200)
        token_1 = qr_resp_1.json()["data"]["token"]

        qr_resp_2 = client_admin.post(f"/api/admin/groups/{group_id}/qr/regenerate")
        self.assertEqual(qr_resp_2.status_code, 200)
        token_2 = qr_resp_2.json()["data"]["token"]
        self.assertNotEqual(token_1, token_2)
        self.assertEqual(GroupQrCode.objects.filter(training_group_id=group_id).count(), 1)
        stored_qr = GroupQrCode.objects.get(training_group_id=group_id)
        self.assertEqual(bytes(stored_qr.token_hash), hashlib.sha256(token_2.encode("utf-8")).digest())

        # Trainee cannot use invalidated token_1
        client_trainee = Client()
        client_trainee.force_login(self.trainee)
        old_join = client_trainee.post(
            "/api/groups/join-by-qr",
            data={"token": token_1},
            content_type="application/json",
        )
        self.assertEqual(old_join.status_code, 404)

        # Valid token_2 creates Pending request
        join_1 = client_trainee.post(
            "/api/groups/join-by-qr",
            data={"token": token_2},
            content_type="application/json",
        )
        self.assertEqual(join_1.status_code, 201)
        req_id_1 = join_1.json()["data"]["joinRequest"]["id"]
        self.assertEqual(join_1.json()["data"]["joinRequest"]["requestStatus"], "Pending")

        # Duplicate Pending blocked by filtered unique index (409)
        dup_join = client_trainee.post(
            "/api/groups/join-by-qr",
            data={"token": token_2},
            content_type="application/json",
        )
        self.assertEqual(dup_join.status_code, 409)

        # Reject request -> OD-PF-04 allows resubmission
        reject_resp = client_admin.post(
            f"/api/admin/groups/{group_id}/join-requests/{req_id_1}/decide",
            data={"decision": "reject"},
            content_type="application/json",
        )
        self.assertEqual(reject_resp.status_code, 200)
        self.assertEqual(reject_resp.json()["data"]["joinRequest"]["requestStatus"], "Rejected")

        # Resubmit after rejection succeeds
        join_2 = client_trainee.post(
            "/api/groups/join-by-qr",
            data={"token": token_2},
            content_type="application/json",
        )
        self.assertEqual(join_2.status_code, 201)
        req_id_2 = join_2.json()["data"]["joinRequest"]["id"]

        # Approve request -> creates GroupMembership
        approve_resp = client_admin.post(
            f"/api/admin/groups/{group_id}/join-requests/{req_id_2}/decide",
            data={"decision": "approve"},
            content_type="application/json",
        )
        self.assertEqual(approve_resp.status_code, 200)
        self.assertTrue(GroupMembership.objects.filter(training_group_id=group_id, user=self.trainee).exists())

        # Already a member -> 409 on QR join
        already_member_join = client_trainee.post(
            "/api/groups/join-by-qr",
            data={"token": token_2},
            content_type="application/json",
        )
        self.assertEqual(already_member_join.status_code, 409)

    def test_renewal_guards_and_overdue_renewal(self) -> None:
        client = Client()
        client.force_login(self.admin)

        # 1. Regular group -> 400
        reg_resp = client.post(
            "/api/admin/groups",
            data={"name": "مجموعة عادية", "groupType": "regular"},
            content_type="application/json",
        )
        reg_id = reg_resp.json()["data"]["group"]["id"]
        self.assertEqual(client.post(f"/api/admin/groups/{reg_id}/renew").status_code, 400)

        # 2. Reminder group with future deadline -> early renewal prohibited 409 (INV-DOM10-11)
        future = (timezone.now() + timedelta(days=10)).isoformat()
        rem_resp = client.post(
            "/api/admin/groups",
            data={
                "name": "مجموعة تجديد",
                "groupType": "reminder",
                "autoRenewalEnabled": True,
                "intervalDays": 14,
                "deadlineDateTime": future,
            },
            content_type="application/json",
        )
        rem_id = rem_resp.json()["data"]["group"]["id"]
        self.assertEqual(client.post(f"/api/admin/groups/{rem_id}/renew").status_code, 409)

        # 3. Archived reminder group -> 409 (API-REC-08A)
        TrainingGroup.objects.filter(pk=rem_id).update(is_archived=True)
        self.assertEqual(client.post(f"/api/admin/groups/{rem_id}/renew").status_code, 409)
        TrainingGroup.objects.filter(pk=rem_id).update(is_archived=False)

        # 4. Missing deadline -> 400
        client.delete(f"/api/admin/groups/{rem_id}/deadline")
        self.assertEqual(client.post(f"/api/admin/groups/{rem_id}/renew").status_code, 400)

        # 5. Overdue reminder group -> succeeds, closes cycle 1 as Expired, creates CYC-<id>-02
        past = timezone.now() - timedelta(days=2)
        TrainingGroup.objects.filter(pk=rem_id).update(deadline_datetime=past, interval_days=14)
        GroupRenewalCycle.objects.filter(training_group_id=rem_id, cycle_number=1).update(deadline_datetime=past)

        renew_resp = client.post(f"/api/admin/groups/{rem_id}/renew")
        self.assertEqual(renew_resp.status_code, 200)
        new_cycle = renew_resp.json()["data"]["cycle"]
        self.assertEqual(new_cycle["cycleCode"], f"CYC-{rem_id}-02")
        self.assertEqual(new_cycle["cycleNumber"], 2)
        self.assertEqual(new_cycle["cycleStatus"], "Active")
        old_cycle = GroupRenewalCycle.objects.get(training_group_id=rem_id, cycle_number=1)
        self.assertEqual(old_cycle.cycle_status, "Expired")

    def test_group_resource_https_validation_and_assistant_scope(self) -> None:
        client = Client()
        client.force_login(self.admin)
        grp_resp = client.post(
            "/api/admin/groups",
            data={"name": "مجموعة الاجتماعات", "groupType": "regular"},
            content_type="application/json",
        )
        group_id = grp_resp.json()["data"]["group"]["id"]

        # Non-HTTPS URL rejected (INV-DOM16-03)
        bad_url = client.post(
            f"/api/admin/groups/{group_id}/resources",
            data={"provider": "teams", "title": "جلسة أسبوعية", "meetingUrl": "http://teams.microsoft.com/meet/1"},
            content_type="application/json",
        )
        self.assertEqual(bad_url.status_code, 400)

        # Unassigned assistant_admin blocked (INV-R9)
        client_asst = Client()
        client_asst.force_login(self.assistant)
        unassigned_resp = client_asst.post(
            f"/api/admin/groups/{group_id}/resources",
            data={"provider": "teams", "title": "جلسة أسبوعية", "meetingUrl": "https://teams.microsoft.com/meet/1"},
            content_type="application/json",
        )
        self.assertEqual(unassigned_resp.status_code, 403)

        # Assign assistant -> now permitted
        GroupAssistantAssignment.objects.create(
            training_group_id=group_id,
            user=self.assistant,
            assignment_role="assistant_admin",
        )
        ok_resp = client_asst.post(
            f"/api/admin/groups/{group_id}/resources",
            data={"provider": "teams", "title": "جلسة أسبوعية", "meetingUrl": "https://teams.microsoft.com/meet/1"},
            content_type="application/json",
        )
        self.assertEqual(ok_resp.status_code, 201)
        self.assertEqual(GroupResource.objects.filter(training_group_id=group_id).count(), 1)

