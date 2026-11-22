"""BP-02 integration tests: phone_e164 login, HttpOnly sessions, CSRF & logout."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.identity.models import RolePolicy, ServerSession, User
from apps.identity.services.auth_service import invalidate_user_sessions
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog


class Bp02AuthAndSessionTests(TestCase):
    """Verify D-AUTH-01 login, logout, /me, CSRF, and ServerSession lifecycle on SQL Server."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_trainee = RolePolicy.objects.create(
            role_key="trainee",
            default_capabilities_json=[],
            updated_at=now,
            updated_by="system",
        )
        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.metro_line = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]

        self.active_user = User.objects.create_user(
            phone_e164="+201012345678",
            password="StrongPassword@123",
            role=self.role_trainee,
            status="Active",
            full_name="متدرب نشط",
            national_id="29901010101010",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="القاهرة",
            date_of_birth=datetime.date(1998, 1, 1),
            metro_line=self.metro_line,
            email="active@cairo-metro.com",
        )
        self.suspended_user = User.objects.create_user(
            phone_e164="+201112345678",
            password="StrongPassword@123",
            role=self.role_trainee,
            status="Suspended",
            full_name="متدرب موقوف",
            national_id="29901010101011",
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="دبلوم",
            address="الجيزة",
            date_of_birth=datetime.date(1997, 5, 5),
            metro_line=self.metro_line,
            email=None,
        )

    def test_csrf_bootstrap_and_valid_login_creates_bound_server_session(self) -> None:
        client = Client(enforce_csrf_checks=True)
        csrf_res = client.get("/api/auth/csrf")
        self.assertEqual(csrf_res.status_code, 200)
        self.assertEqual(csrf_res.json(), {"status": "OK", "data": {"csrfReady": True}})
        csrf_token = csrf_res.cookies["csrftoken"].value

        login_res = client.post(
            "/api/auth/login",
            data={"phone_e164": " +201012345678 ", "password": "StrongPassword@123"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_res.status_code, 200)
        body = login_res.json()
        self.assertEqual(body["status"], "OK")
        self.assertEqual(body["data"]["user"]["phoneE164"], "+201012345678")
        self.assertEqual(body["data"]["user"]["role"], "trainee")
        self.assertNotIn("password", body["data"]["user"])
        self.assertNotIn("token", body["data"])

        # HttpOnly sessionid cookie set & ServerSession bound to active_user
        self.assertTrue(login_res.cookies["sessionid"]["httponly"])
        self.assertEqual(ServerSession.objects.filter(user=self.active_user).count(), 1)

        # GET /api/auth/me succeeds with session cookie
        me_res = client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 200)
        self.assertEqual(me_res.json()["data"]["user"]["id"], str(self.active_user.id))

    def test_invalid_credentials_and_suspended_user_rejected_without_session(self) -> None:
        client = Client(enforce_csrf_checks=True)
        csrf_token = client.get("/api/auth/csrf").cookies["csrftoken"].value

        bad_pwd = client.post(
            "/api/auth/login",
            data={"phone_e164": "+201012345678", "password": "WrongPassword"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(bad_pwd.status_code, 401)
        self.assertEqual(bad_pwd.json()["status"], "ERROR")
        self.assertEqual(bad_pwd.json()["code"], "INVALID_CREDENTIALS")
        self.assertEqual(ServerSession.objects.count(), 0)

        susp = client.post(
            "/api/auth/login",
            data={"phone_e164": "+201112345678", "password": "StrongPassword@123"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(susp.status_code, 401)
        self.assertEqual(ServerSession.objects.count(), 0)

    def test_unauthenticated_me_returns_401_standard_error(self) -> None:
        client = Client()
        res = client.get("/api/auth/me")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["status"], "ERROR")
        self.assertEqual(res.json()["code"], "AUTHENTICATION_REQUIRED")

    def test_logout_enforces_csrf_and_deletes_server_session(self) -> None:
        client = Client(enforce_csrf_checks=True)
        csrf1 = client.get("/api/auth/csrf").cookies["csrftoken"].value
        login_res = client.post(
            "/api/auth/login",
            data={"phone_e164": "+201012345678", "password": "StrongPassword@123"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf1,
        )
        self.assertEqual(login_res.status_code, 200)
        rotated_csrf = login_res.cookies["csrftoken"].value

        # Missing CSRF rejected with 403
        no_csrf = client.post("/api/auth/logout", data={}, content_type="application/json")
        self.assertEqual(no_csrf.status_code, 403)
        self.assertEqual(ServerSession.objects.filter(user=self.active_user).count(), 1)

        # Valid CSRF deletes ServerSession & invalidates /api/auth/me
        ok_logout = client.post(
            "/api/auth/logout",
            data={},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=rotated_csrf,
        )
        self.assertEqual(ok_logout.status_code, 200)
        self.assertEqual(ok_logout.json()["status"], "OK")
        self.assertTrue(ok_logout.json()["data"]["success"])
        self.assertEqual(ServerSession.objects.filter(user=self.active_user).count(), 0)
        self.assertEqual(client.get("/api/auth/me").status_code, 401)

    def test_suspended_after_login_invalidates_me_with_401(self) -> None:
        client = Client(enforce_csrf_checks=True)
        csrf_token = client.get("/api/auth/csrf").cookies["csrftoken"].value
        client.post(
            "/api/auth/login",
            data={"phone_e164": "+201012345678", "password": "StrongPassword@123"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        User.objects.filter(pk=self.active_user.pk).update(status="Suspended")

        me_res = client.get("/api/auth/me")
        self.assertEqual(me_res.status_code, 401)
        self.assertEqual(me_res.json()["code"], "AUTHENTICATION_REQUIRED")
        self.assertEqual(invalidate_user_sessions(self.active_user.id), 1)
        self.assertEqual(ServerSession.objects.filter(user=self.active_user).count(), 0)
