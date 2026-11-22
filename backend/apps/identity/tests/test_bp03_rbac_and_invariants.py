"""BP-03 integration tests: 6-tier RBAC, INV-R1..INV-R9, overrides, delegation & 404 parity."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.identity.models import DelegatedAuthority, RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES, evaluate_permission


class Bp03RbacAndInvariantsTests(TestCase):
    """Verify 6-tier RBAC, INV-R1..INV-R9, RolePolicy ceilings, and INV-R8 404 parity."""

    def setUp(self) -> None:
        now = timezone.now()
        self.roles = {}
        for role_key, caps in ROLE_DEFAULT_CAPABILITIES.items():
            self.roles[role_key] = RolePolicy.objects.create(
                role_key=role_key,
                default_capabilities_json=sorted(caps),
                updated_at=now,
                updated_by="system",
            )

        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.metro_line = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]

        def make_user(phone: str, nid: str, role_key: str, name: str) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="TestPassword@123",
                role=self.roles[role_key],
                status="Active",
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

        self.developer = make_user("+201000000000", "29501010101000", "developer", "مطور النظام")
        self.super_admin = make_user("+201000000001", "29501010101001", "super_admin", "مدير أعلى")
        self.super_admin_peer = make_user("+201000000002", "29501010101002", "super_admin", "مدير أعلى زميل")
        self.admin = make_user("+201000000003", "29501010101003", "admin", "مدير النظام")
        self.assistant = make_user("+201000000004", "29501010101004", "assistant_admin", "مساعد مدير")
        self.lecturer = make_user("+201000000005", "29501010101005", "lecturer", "محاضر")
        self.trainee = make_user("+201000000006", "29501010101006", "trainee", "متدرب")

    def _login_client(self, phone: str) -> Client:
        client = Client()
        res = client.post(
            "/api/auth/login",
            data={"phone_e164": phone, "password": "TestPassword@123"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return client

    def test_inv_r8_developer_hidden_with_404_across_rbac_endpoints(self) -> None:
        admin_client = self._login_client(self.admin.phone_e164)

        roles_res = admin_client.get("/api/admin/permissions/roles")
        self.assertEqual(roles_res.status_code, 200)
        role_keys = [r["roleKey"] for r in roles_res.json()["data"]["roles"]]
        self.assertNotIn("developer", role_keys)

        self.assertEqual(admin_client.get("/api/admin/permissions/roles/developer").status_code, 404)
        self.assertEqual(admin_client.get(f"/api/admin/permissions/users/{self.developer.id}").status_code, 404)
        self.assertEqual(admin_client.get(f"/api/admin/permissions/effective/{self.developer.id}").status_code, 404)
        self.assertEqual(
            admin_client.get(f"/api/admin/permissions/governance/delegation/{self.developer.id}").status_code, 404
        )

        # Developer sees developer policy
        dev_client = self._login_client(self.developer.phone_e164)
        self.assertEqual(dev_client.get("/api/admin/permissions/roles/developer").status_code, 200)

    def test_inv_r1_to_r6_invariants_enforced(self) -> None:
        # INV-R2: Nobody can promote to developer
        self.assertFalse(
            evaluate_permission(self.super_admin, "users.change_role", target_user=self.admin, new_role="developer").granted
        )
        # INV-R3: Admin cannot mutate or create super_admin / admin
        self.assertFalse(
            evaluate_permission(self.admin, "users.create", new_role="admin").granted
        )
        # INV-R6: super_admin can mutate admin, but NOT peer super_admin or self
        self.assertTrue(
            evaluate_permission(self.super_admin, "users.delete", target_user=self.admin).granted
        )
        self.assertFalse(
            evaluate_permission(self.super_admin, "users.delete", target_user=self.super_admin_peer).granted
        )
        self.assertFalse(
            evaluate_permission(self.admin, "users.delete", target_user=self.admin).granted
        )

    def test_inv_r7_and_inv_r9_assistant_admin_scope_and_delegation(self) -> None:
        # INV-R7: Group-scoped write denied outside assigned group
        unassigned = evaluate_permission(self.assistant, "groups.manage_members", is_group_assigned=False)
        self.assertFalse(unassigned.granted)
        self.assertEqual(unassigned.execution_mode, "denied")

        # INV-R9: Assigned group mutation defaults to requires_approval (202)
        default_res = evaluate_permission(self.assistant, "groups.manage_members", is_group_assigned=True)
        self.assertTrue(default_res.granted)
        self.assertEqual(default_res.execution_mode, "requires_approval")

        # Admin delegates exact capability -> switches to direct execution
        admin_client = self._login_client(self.admin.phone_e164)
        grant_res = admin_client.post(
            f"/api/admin/permissions/governance/delegation/{self.assistant.id}",
            data={"capabilityKey": "groups.manage_members"},
            content_type="application/json",
        )
        self.assertEqual(grant_res.status_code, 201)
        self.assertTrue(DelegatedAuthority.objects.filter(user=self.assistant, is_active=True).exists())

        delegated_res = evaluate_permission(self.assistant, "groups.manage_members", is_group_assigned=True)
        self.assertTrue(delegated_res.granted)
        self.assertEqual(delegated_res.execution_mode, "direct")

        # Revoke delegation -> reverts to requires_approval
        rev_res = admin_client.delete(
            f"/api/admin/permissions/governance/delegation/{self.assistant.id}",
            data={"capabilityKey": "groups.manage_members"},
            content_type="application/json",
        )
        self.assertEqual(rev_res.status_code, 200)
        after_rev = evaluate_permission(self.assistant, "groups.manage_members", is_group_assigned=True)
        self.assertEqual(after_rev.execution_mode, "requires_approval")

        # Immutable blocked capability cannot be delegated to assistant_admin
        blocked_res = admin_client.post(
            f"/api/admin/permissions/governance/delegation/{self.assistant.id}",
            data={"capabilityKey": "courses.publish"},
            content_type="application/json",
        )
        self.assertEqual(blocked_res.status_code, 403)

    def test_role_ceiling_and_user_override_precedence(self) -> None:
        admin_client = self._login_client(self.admin.phone_e164)

        # Exceeding ceiling on RolePolicy rejected
        bad_policy = admin_client.patch(
            "/api/admin/permissions/roles/trainee",
            data={"defaultCapabilities": ["learning.access_assigned", "users.delete"]},
            content_type="application/json",
        )
        self.assertEqual(bad_policy.status_code, 400)

        # Denied override revokes capability on assistant_admin
        ov_res = admin_client.patch(
            f"/api/admin/permissions/users/{self.assistant.id}",
            data={"grantedCapabilities": [], "deniedCapabilities": ["groups.create"]},
            content_type="application/json",
        )
        self.assertEqual(ov_res.status_code, 200)
        denied_decision = evaluate_permission(self.assistant, "groups.create")
        self.assertFalse(denied_decision.granted)
        self.assertEqual(denied_decision.source, "user_override")

        # Effective permissions endpoint reflects revoked capability
        eff_res = admin_client.get(f"/api/admin/permissions/effective/{self.assistant.id}")
        self.assertEqual(eff_res.status_code, 200)
        self.assertFalse(eff_res.json()["data"]["effective"]["groups.create"]["granted"])

