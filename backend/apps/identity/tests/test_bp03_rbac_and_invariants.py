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

    def test_employee_number_create_update_conflict_and_profile(self) -> None:
        admin_client = self._login_client(self.admin.phone_e164)
        base_payload = {
            "name": "موظف رقم وظيفي",
            "nameEn": "Tarek Mohamed",
            "phone": "01099887766",
            "nationalId": "29501010109876",
            "dateOfBirth": "1995-01-01",
            "address": "القاهرة",
            "educationalQualification": "بكالوريوس هندسة",
            "maritalStatusId": self.marital.id,
            "militaryServiceStatusId": self.military.id,
            "appointmentDate": "2022-01-01",
            "metroLineId": self.metro_line.id,
            "department": "التشغيل",
            "jobTitle": "مهندس تشغيل",
            "role": "user",
            "status": "Active",
            "password": "StrongUserPass!99",
            "employeeNumber": "EMP-7001",
        }
        create_res = admin_client.post(
            "/api/admin/users",
            data=base_payload,
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        created_user = create_res.json()["data"]
        self.assertEqual(created_user["employeeNumber"], "EMP-7001")
        self.assertEqual(created_user["nameEn"], "Tarek Mohamed")

        # Duplicate employeeNumber returns 409 CONFLICT
        dup_payload = {
            **base_payload,
            "phone": "01099887767",
            "nationalId": "29501010109877",
        }
        dup_res = admin_client.post(
            "/api/admin/users",
            data=dup_payload,
            content_type="application/json",
        )
        self.assertEqual(dup_res.status_code, 409)

        # Update employeeNumber and nameEn via PUT /api/admin/users/<id>
        uid = created_user["id"]
        update_res = admin_client.put(
            f"/api/admin/users/{uid}",
            data={"employeeNumber": "EMP-7002", "nameEn": "Tarek Mohamed Ali"},
            content_type="application/json",
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["data"]["employeeNumber"], "EMP-7002")
        self.assertEqual(update_res.json()["data"]["nameEn"], "Tarek Mohamed Ali")

        # Transcript reflects updated employeeNumber and nameEn
        tr_res = admin_client.get(f"/api/admin/users/{uid}/transcript")
        self.assertEqual(tr_res.status_code, 200)
        self.assertEqual(tr_res.json()["data"]["user"]["employeeNumber"], "EMP-7002")
        self.assertEqual(tr_res.json()["data"]["user"]["nameEn"], "Tarek Mohamed Ali")

        # /api/profile returns employeeNumber and nameEn for the authenticated user
        user_client = Client()
        login_res = user_client.post(
            "/api/auth/login",
            data={"phone_e164": "+201099887766", "password": "StrongUserPass!99"},
            content_type="application/json",
        )
        self.assertEqual(login_res.status_code, 200)
        profile_res = user_client.get("/api/profile")
        self.assertEqual(profile_res.status_code, 200)
        self.assertEqual(profile_res.json()["data"]["user"]["employeeNumber"], "EMP-7002")
        self.assertEqual(profile_res.json()["data"]["user"]["nameEn"], "Tarek Mohamed Ali")

    def test_admin_suspend_and_reactivate_user_returns_full_dto_and_invalidates_sessions(self) -> None:
        from apps.governance.models import AuditLogEntry
        from apps.identity.models import ServerSession

        lecturer_client = self._login_client(self.lecturer.phone_e164)
        self.assertGreaterEqual(ServerSession.objects.filter(user_id=self.lecturer.id).count(), 1)
        _ = lecturer_client

        admin_client = self._login_client(self.admin.phone_e164)
        csrf_res = admin_client.get("/api/auth/csrf")
        csrf_token = csrf_res.cookies["csrftoken"].value

        suspend_res = admin_client.patch(
            f"/api/admin/users/{self.lecturer.id}/status",
            data={"status": "suspended", "reason": "إيقاف مؤقت للاختبار"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(suspend_res.status_code, 200)
        suspend_data = suspend_res.json()["data"]
        self.assertEqual(suspend_data["id"], str(self.lecturer.id))
        self.assertEqual(suspend_data["name"], self.lecturer.full_name)
        self.assertEqual(suspend_data["status"], "suspended")
        self.assertEqual(suspend_data["role"], "lecturer")
        self.assertEqual(ServerSession.objects.filter(user_id=self.lecturer.id).count(), 0)
        self.assertTrue(
            AuditLogEntry.objects.filter(
                action="user.status_changed",
                target_entity_id=str(self.lecturer.id),
            ).exists()
        )

        reactivate_res = admin_client.patch(
            f"/api/admin/users/{self.lecturer.id}/status",
            data={"status": "active", "reason": "إعادة تفعيل للاختبار"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(reactivate_res.status_code, 200)
        reactivate_data = reactivate_res.json()["data"]
        self.assertEqual(reactivate_data["id"], str(self.lecturer.id))
        self.assertEqual(reactivate_data["name"], self.lecturer.full_name)
        self.assertEqual(reactivate_data["status"], "active")

        role_res = admin_client.patch(
            f"/api/admin/users/{self.trainee.id}/role",
            data={"role": "lecturer"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(role_res.status_code, 200)
        role_data = role_res.json()["data"]
        self.assertEqual(role_data["id"], str(self.trainee.id))
        self.assertEqual(role_data["name"], self.trainee.full_name)
        self.assertEqual(role_data["role"], "lecturer")
        self.assertEqual(role_data["status"], "active")


