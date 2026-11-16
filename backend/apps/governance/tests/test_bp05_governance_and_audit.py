"""BP-05 integration tests: PendingApprovalRequest (202/409/INV-R10) & AuditLogEntry (D-14)."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.governance.models import PendingApprovalRequest
from apps.governance.services.governance_service import decide_pending_approval, record_audit_log
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp05GovernanceAndAuditTests(TestCase):
    """Verify PendingApprovalRequest UUID workflow, 409 ALREADY_DECIDED, INV-R10, and D-14 masking."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_dev = RolePolicy.objects.create(
            role_key="developer",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["developer"]),
            updated_at=now,
            updated_by="system",
        )
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
        self.marital = MaritalStatusCatalog.objects.create(code="single", name_ar="أعزب")
        self.military = MilitaryServiceStatusCatalog.objects.create(code="completed", name_ar="أنهى الخدمة")
        self.metro_line = MetroLine.objects.create(name_ar="الخط الأول")

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

        self.developer = make_user("+201000000200", "29501010103000", self.role_dev, "مطور")
        self.admin = make_user("+201000000201", "29501010103001", self.role_admin, "مدير")
        self.assistant = make_user("+201000000202", "29501010103002", self.role_assistant, "مساعد")

    def _login(self, phone: str) -> Client:
        c = Client()
        res = c.post(
            "/api/auth/login",
            data={"phone_e164": phone, "password": "TestPassword@123"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return c

    def test_approval_202_decision_409_and_inv_r10_execution_failed(self) -> None:
        assistant_client = self._login(self.assistant.phone_e164)
        admin_client = self._login(self.admin.phone_e164)

        create_res = assistant_client.post(
            "/api/admin/permissions/governance/approvals",
            data={
                "actionType": "group_delete",
                "targetEntityType": "TrainingGroup",
                "targetEntityId": "42",
                "payloadSnapshot": {"groupId": 42},
                "reason": "  طلب حذف  ",
            },
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 202)
        req_id = create_res.json()["data"]["approvalRequestId"]

        # Assistant cannot decide approvals (403)
        self.assertEqual(
            assistant_client.post(
                f"/api/admin/permissions/governance/approvals/{req_id}/decide",
                data={"decision": "approve"},
                content_type="application/json",
            ).status_code,
            403,
        )

        # Admin approves -> Executed
        dec_res = admin_client.post(
            f"/api/admin/permissions/governance/approvals/{req_id}/decide",
            data={"decision": "approve", "reason": "موافق"},
            content_type="application/json",
        )
        self.assertEqual(dec_res.status_code, 200)
        self.assertEqual(dec_res.json()["data"]["approval"]["executionStatus"], "Executed")

        # Second decision -> 409 ALREADY_DECIDED
        dup_res = admin_client.post(
            f"/api/admin/permissions/governance/approvals/{req_id}/decide",
            data={"decision": "reject"},
            content_type="application/json",
        )
        self.assertEqual(dup_res.status_code, 409)
        self.assertEqual(dup_res.json()["code"], "ALREADY_DECIDED")

        # INV-R10: Failed execution callback transitions to ExecutionFailed
        req2 = PendingApprovalRequest.objects.create(
            action_type="enrollment_remove",
            execution_status="Pending",
            requested_by_id=str(self.assistant.id),
            target_entity_type="Enrollment",
            target_entity_id="99",
            payload_snapshot_json={"enrollmentId": 99},
            created_at=timezone.now(),
        )
        res2 = decide_pending_approval(
            request_id=req2.id,
            reviewer=self.admin,
            decision="approve",
            executor_fn=lambda _r: False,
        )
        self.assertEqual(res2.execution_status, "ExecutionFailed")

    def test_audit_log_masks_developer_entries_for_non_developers(self) -> None:
        record_audit_log(
            action="system.bootstrap",
            actor=self.developer,
            target_entity_type="RolePolicy",
            target_entity_id="developer",
        )
        admin_client = self._login(self.admin.phone_e164)
        dev_client = self._login(self.developer.phone_e164)

        admin_logs = admin_client.get("/api/admin/audit").json()["data"]["logs"]
        dev_entry_for_admin = next(l for l in admin_logs if l["action"] == "system.bootstrap")
        self.assertEqual(dev_entry_for_admin["actorUserId"], "SYSTEM")
        self.assertEqual(dev_entry_for_admin["actorRoleSnapshot"], "النظام")

        dev_logs = dev_client.get("/api/admin/audit").json()["data"]["logs"]
        dev_entry_for_dev = next(l for l in dev_logs if l["action"] == "system.bootstrap")
        self.assertEqual(dev_entry_for_dev["actorUserId"], str(self.developer.id))
        self.assertEqual(dev_entry_for_dev["actorRoleSnapshot"], "developer")

