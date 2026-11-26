"""Sprint 1 Security Remediation Tests on real Django + Microsoft SQL Server (BUG-001..005, BUG-016)."""
from __future__ import annotations

import datetime
import json
from io import StringIO
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import Client, RequestFactory, TestCase, override_settings
from django.utils import timezone

from apps.courses.models import (
    Course,
    CourseAudienceMetroLine,
    CourseDraft,
    PublishedCourseVersion,
)
from apps.courses.services.course_service import (
    create_course,
    decide_course_review,
    save_course_draft,
    submit_course_for_review,
)
from apps.groups.api.views.groups import _repair_material_file_record
from apps.groups.services.group_service import create_training_group
from apps.identity.models import RolePolicy, ServerSession, User
from apps.identity.services.login_rate_limit import clear_login_failures, get_client_ip
from apps.learning.models import Enrollment
from apps.media.models import MediaAsset, MediaContentReference
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Sprint01SecurityRemediationTests(TestCase):
    """End-to-end security verification against SQL Server (no MSW / no SQLite)."""

    def setUp(self) -> None:
        cache.clear()
        now = timezone.now()
        self.roles = {}
        for rk in ("developer", "super_admin", "admin", "assistant_admin", "lecturer", "trainee"):
            self.roles[rk], _ = RolePolicy.objects.get_or_create(
                role_key=rk,
                defaults={
                    "default_capabilities_json": sorted(ROLE_DEFAULT_CAPABILITIES[rk]),
                    "updated_at": now,
                    "updated_by": "sprint01_test",
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
                password="StrongSec@2026",
                role=self.roles[rk],
                status="Active",
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

        self.admin = make_user("+201070000001", "29501010107001", "admin", "مدير أمني", self.line1)
        self.lecturer_a = make_user("+201070000002", "29501010107002", "lecturer", "محاضر أ", self.line1)
        self.lecturer_b = make_user("+201070000003", "29501010107003", "lecturer", "محاضر ب", self.line1)
        self.trainee_line1 = make_user("+201070000004", "29501010107004", "trainee", "متدرب خط 1", self.line1)
        self.trainee_line2 = make_user("+201070000005", "29501010107005", "trainee", "متدرب خط 2", self.line2)

    # ── BUG-001: Login & Logout CSRF ──────────────────────────────────────────
    def test_bug001_login_and_logout_enforce_csrf_tokens(self) -> None:
        client = Client(enforce_csrf_checks=True)

        # 1. Missing CSRF token on login -> 403 Forbidden, 0 sessions
        no_csrf = client.post(
            "/api/auth/login",
            data={"phone_e164": self.trainee_line1.phone_e164, "password": "StrongSec@2026"},
            content_type="application/json",
        )
        self.assertEqual(no_csrf.status_code, 403)
        self.assertEqual(ServerSession.objects.count(), 0)

        # 2. Invalid CSRF token on login -> 403 Forbidden, 0 sessions
        bad_csrf = client.post(
            "/api/auth/login",
            data={"phone_e164": self.trainee_line1.phone_e164, "password": "StrongSec@2026"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN="invalid-csrf-token-value-1234567890",
        )
        self.assertEqual(bad_csrf.status_code, 403)
        self.assertEqual(ServerSession.objects.count(), 0)

        # 3. Bootstrap CSRF -> valid login -> /me -> logout without CSRF (403) -> logout with rotated CSRF (200)
        csrf_res = client.get("/api/auth/csrf")
        self.assertEqual(csrf_res.status_code, 200)
        token = csrf_res.cookies["csrftoken"].value

        ok_login = client.post(
            "/api/auth/login",
            data={"phone_e164": self.trainee_line1.phone_e164, "password": "StrongSec@2026"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(ok_login.status_code, 200)
        self.assertTrue(ok_login.cookies["sessionid"]["httponly"])
        self.assertEqual(ServerSession.objects.filter(user=self.trainee_line1).count(), 1)
        rotated_csrf = ok_login.cookies["csrftoken"].value

        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        self.assertEqual(client.post("/api/auth/logout", data={}, content_type="application/json").status_code, 403)
        self.assertEqual(
            client.post(
                "/api/auth/logout",
                data={},
                content_type="application/json",
                HTTP_X_CSRFTOKEN=rotated_csrf,
            ).status_code,
            200,
        )
        self.assertEqual(client.get("/api/auth/me").status_code, 401)

    # ── BUG-002: Test Accounts Seed Isolation & Real Django Login ─────────────
    def test_bug002_seed_demo_roles_authenticates_against_django_and_blocks_production(self) -> None:
        out = StringIO()
        call_command("seed_demo_roles", stdout=out)
        self.assertIn("MetroTest@2026", out.getvalue())

        # Every seeded test account logs in cleanly via real Django auth & CSRF with correct role
        for phone, expected_role in (
            ("+201000000002", "super_admin"),
            ("+201000000003", "admin"),
            ("+201000000004", "assistant_admin"),
            ("+201000000005", "lecturer"),
            ("+201000000006", "trainee"),
        ):
            c = Client(enforce_csrf_checks=True)
            csrf = c.get("/api/auth/csrf").cookies["csrftoken"].value
            res = c.post(
                "/api/auth/login",
                data={"phone_e164": phone, "password": "MetroTest@2026"},
                content_type="application/json",
                HTTP_X_CSRFTOKEN=csrf,
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["data"]["user"]["role"], expected_role)

        # Must refuse seeding under config.settings.production
        with patch.dict("os.environ", {"DJANGO_SETTINGS_MODULE": "config.settings.production"}):
            with self.assertRaises(CommandError):
                call_command("seed_demo_roles")

    # ── BUG-003: Targeted & Hidden Course Self-Enrollment Bypass ──────────────
    def test_bug003_targeted_and_hidden_course_enrollment_authorization(self) -> None:
        targeted_course = create_course(
            actor=self.lecturer_a,
            title="دورة موجهة خط 1",
            description="وصف موجه",
            course_type="main",
            primary_lecturer=self.lecturer_a,
        )
        targeted_course.access_mode = "targeted"
        targeted_course.save(update_fields=["access_mode", "updated_at"])
        CourseAudienceMetroLine.objects.create(course=targeted_course, metro_line=self.line1)
        save_course_draft(
            actor=self.lecturer_a,
            course=targeted_course,
            title_snapshot="دورة موجهة خط 1",
            modules_payload=[{"title": "وحدة 1", "lessons": [{"title": "درس 1", "type": "document"}]}],
        )
        sub = submit_course_for_review(actor=self.lecturer_a, course=targeted_course)
        decide_course_review(reviewer=self.admin, submission=sub, decision="approve")

        hidden_course = create_course(
            actor=self.lecturer_a,
            title="دورة مخفية",
            description="وصف مخفي",
            course_type="main",
            primary_lecturer=self.lecturer_a,
        )
        hidden_course.access_mode = "hidden"
        hidden_course.save(update_fields=["access_mode", "updated_at"])
        save_course_draft(
            actor=self.lecturer_a,
            course=hidden_course,
            title_snapshot="دورة مخفية",
            modules_payload=[{"title": "وحدة", "lessons": [{"title": "درس", "type": "document"}]}],
        )
        decide_course_review(
            reviewer=self.admin,
            submission=submit_course_for_review(actor=self.lecturer_a, course=hidden_course),
            decision="approve",
        )

        # 1. Excluded trainee (line2) rejected on targeted course -> 403, 0 rows
        c2 = Client()
        c2.force_login(self.trainee_line2)
        res_denied = c2.post(f"/api/courses/{targeted_course.id}/enrollments", data={}, content_type="application/json")
        self.assertEqual(res_denied.status_code, 403)
        self.assertFalse(Enrollment.objects.filter(user=self.trainee_line2, course=targeted_course).exists())

        # 2. Hidden course rejects direct self-enrollment -> 403, 0 rows
        c1 = Client()
        c1.force_login(self.trainee_line1)
        res_hidden = c1.post(f"/api/courses/{hidden_course.id}/enrollments", data={}, content_type="application/json")
        self.assertEqual(res_hidden.status_code, 403)
        self.assertFalse(Enrollment.objects.filter(user=self.trainee_line1, course=hidden_course).exists())

        # 3. Spoofing sourceType="group" as trainee rejected -> 403
        grp, _ = create_training_group(
            actor=self.admin,
            name="مجموعة اختبار",
            group_type="regular",
            deadline_datetime=None,
            auto_renewal_enabled=False,
            interval_days=None,
        )
        res_spoof = c1.post(
            f"/api/courses/{targeted_course.id}/enrollments",
            data={"sourceType": "group", "trainingGroupId": grp.id},
            content_type="application/json",
        )
        self.assertEqual(res_spoof.status_code, 403)

        # 4. Eligible trainee (line1) self-enrolls on targeted course -> 201 & duplicate is idempotent
        res_ok = c1.post(f"/api/courses/{targeted_course.id}/enrollments", data={}, content_type="application/json")
        self.assertEqual(res_ok.status_code, 201)
        self.assertEqual(Enrollment.objects.filter(user=self.trainee_line1, course=targeted_course).count(), 1)
        res_dup = c1.post(f"/api/courses/{targeted_course.id}/enrollments", data={}, content_type="application/json")
        self.assertEqual(res_dup.status_code, 201)
        self.assertEqual(Enrollment.objects.filter(user=self.trainee_line1, course=targeted_course).count(), 1)

        # 5. Admin enrollment on hidden course for excluded trainee succeeds cleanly -> 201
        ca = Client()
        ca.force_login(self.admin)
        res_admin = ca.post(
            f"/api/courses/{hidden_course.id}/enrollments",
            data={"userId": self.trainee_line2.id, "sourceType": "direct"},
            content_type="application/json",
        )
        self.assertEqual(res_admin.status_code, 201)
        self.assertTrue(Enrollment.objects.filter(user=self.trainee_line2, course=hidden_course).exists())

    # ── BUG-004: Cross-Lecturer Media IDOR & MIME Repair Block ────────────────
    def test_bug004_cross_lecturer_media_idor_and_repair_protection(self) -> None:
        course_a = create_course(
            actor=self.lecturer_a,
            title="دورة أ",
            description="وصف أ",
            course_type="main",
            primary_lecturer=self.lecturer_a,
        )
        draft_a = CourseDraft.objects.get(course=course_a)

        cb = Client()
        cb.force_login(self.lecturer_b)
        up_b = cb.post(
            "/api/media/assets/upload",
            {"file": SimpleUploadedFile("b_secret.pdf", b"%PDF-1.4\nSECRET-B", content_type="application/pdf")},
        )
        self.assertEqual(up_b.status_code, 201)
        asset_b_id = int(up_b.json()["data"]["asset"]["id"])

        ca_lec = Client()
        ca_lec.force_login(self.lecturer_a)

        # 1. Direct MediaContentReference IDOR -> 403, 0 rows
        ref_idor = ca_lec.post(
            "/api/media/references",
            data={"mediaAssetId": asset_b_id, "courseDraftId": draft_a.id, "title": "ملف مسروق"},
            content_type="application/json",
        )
        self.assertEqual(ref_idor.status_code, 403)
        self.assertFalse(MediaContentReference.objects.filter(media_asset_id=asset_b_id, course_draft=draft_a).exists())

        # 2. Course draft save IDOR (lesson mediaId & thumbnailAssetId) -> 403
        draft_idor = ca_lec.put(
            f"/api/lecturer/courses/{course_a.id}/draft",
            data={
                "titleSnapshot": "دورة أ",
                "modules": [{"title": "وحدة", "lessons": [{"title": "درس", "type": "pdf", "mediaId": str(asset_b_id)}]}],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_idor.status_code, 403)
        self.assertFalse(MediaContentReference.objects.filter(media_asset_id=asset_b_id).exists())

        # 3. Admin group material attach IDOR by unauthorized lecturer / group mismatch -> 403
        grp, _ = create_training_group(
            actor=self.admin,
            name="مجموعة وسائط",
            group_type="regular",
            deadline_datetime=None,
            auto_renewal_enabled=False,
            interval_days=None,
        )
        ca_lec_grp = Client()
        ca_lec_grp.force_login(self.lecturer_a)
        # Even if admin calls group materials with foreign/unrelated asset ID, non-admin lecturer must be blocked
        from apps.groups.models import GroupAssistantAssignment

        GroupAssistantAssignment.objects.create(training_group=grp, user=self.lecturer_a, assignment_role="primary")
        grp_idor = ca_lec_grp.post(
            f"/api/admin/groups/{grp.id}/materials/files",
            data={"title": "مادة مسروقة", "mediaAssetId": asset_b_id},
            content_type="application/json",
        )
        self.assertEqual(grp_idor.status_code, 403)

        # 4. _repair_material_file_record NEVER matches arbitrary MediaAsset by MIME when mediaId missing
        orphan_record = {"title": "ملف بلا معرف", "mimeType": "application/pdf", "sizeBytes": 0}
        _repair_material_file_record(orphan_record, group_id=grp.id)
        self.assertNotIn("mediaAssetId", orphan_record)
        self.assertNotIn("mediaId", orphan_record)
        self.assertNotIn("url", orphan_record)

        # 5. Admin retains legitimate attachment access
        c_adm = Client()
        c_adm.force_login(self.admin)
        ok_adm = c_adm.post(
            "/api/media/references",
            data={"mediaAssetId": asset_b_id, "courseDraftId": draft_a.id, "title": "ملف معتمد إدارياً"},
            content_type="application/json",
        )
        self.assertEqual(ok_adm.status_code, 201)

    # ── BUG-005: Unpublished CourseDraft Isolation ────────────────────────────
    def test_bug005_published_course_hides_unpublished_draft_edits_from_trainees(self) -> None:
        course = create_course(
            actor=self.lecturer_a,
            title="دورة النشر الآمن",
            description="وصف منشور",
            course_type="main",
            primary_lecturer=self.lecturer_a,
        )
        course.access_mode = "all_trainees"
        course.save(update_fields=["access_mode"])
        save_course_draft(
            actor=self.lecturer_a,
            course=course,
            title_snapshot="دورة النشر الآمن",
            modules_payload=[{"title": "الوحدة المنشورة v1", "lessons": [{"title": "درس v1", "type": "document"}]}],
        )
        decide_course_review(
            reviewer=self.admin,
            submission=submit_course_for_review(actor=self.lecturer_a, course=course),
            decision="approve",
        )
        # Lecturer saves new unpublished draft edits AFTER v1 was published
        save_course_draft(
            actor=self.lecturer_a,
            course=course,
            title_snapshot="دورة النشر الآمن (تعديل غير منشور)",
            modules_payload=[
                {"title": "الوحدة المنشورة v1", "lessons": [{"title": "درس v1", "type": "document"}]},
                {"title": "وحدة مسودة سرية v2", "lessons": [{"title": "درس سري", "type": "document"}]},
            ],
        )

        # Draft-only course for negative check
        draft_only = create_course(
            actor=self.lecturer_a,
            title="مسودة فقط",
            description="وصف",
            course_type="main",
            primary_lecturer=self.lecturer_a,
        )

        # Trainee sees ONLY PublishedCourseVersion v1 across detail, catalog, and /enrollments/my
        ct = Client()
        ct.force_login(self.trainee_line1)
        ct.post(f"/api/courses/{course.id}/enrollments", data={}, content_type="application/json")

        det = ct.get(f"/api/courses/{course.id}").json()["data"]["course"]
        self.assertEqual([m["title"] for m in det["modules"]], ["الوحدة المنشورة v1"])
        self.assertFalse(det["hasDraft"])

        cat = ct.get("/api/courses").json()["data"]["courses"]
        cat_match = next(c for c in cat if c["id"] == str(course.id))
        self.assertEqual([m["title"] for m in cat_match["modules"]], ["الوحدة المنشورة v1"])
        self.assertNotIn(str(draft_only.id), [c["id"] for c in cat])

        my_enr = ct.get("/api/enrollments/my").json()["data"]["enrollments"]
        self.assertEqual([m["title"] for m in my_enr[0]["modules"]], ["الوحدة المنشورة v1"])

        # Trainee rejected on draft-only course -> 404
        self.assertEqual(ct.get(f"/api/courses/{draft_only.id}").status_code, 404)

        # Owner lecturer & admin still retain draft visibility in builder/detail
        cl = Client()
        cl.force_login(self.lecturer_a)
        lec_det = cl.get(f"/api/lecturer/courses/{course.id}").json()["data"]["course"]
        self.assertEqual(
            [m["title"] for m in lec_det["modules"]],
            ["الوحدة المنشورة v1", "وحدة مسودة سرية v2"],
        )
        self.assertTrue(lec_det["hasDraft"])

        ca = Client()
        ca.force_login(self.admin)
        adm_det = ca.get(f"/api/courses/{course.id}").json()["data"]["course"]
        self.assertEqual(
            [m["title"] for m in adm_det["modules"]],
            ["الوحدة المنشورة v1", "وحدة مسودة سرية v2"],
        )

    # ── BUG-016: Spoofable X-Forwarded-For IP Derivation & Lockout ───────────
    def test_bug016_ip_derivation_ignores_spoofed_xff_and_honors_trusted_proxies(self) -> None:
        rf = RequestFactory()

        # 1. Direct request (no trusted proxies) ignores forged X-Forwarded-For
        with override_settings(METROLMS_TRUSTED_PROXY_IPS=[]):
            req = rf.post(
                "/api/auth/login",
                REMOTE_ADDR="198.51.100.77",
                HTTP_X_FORWARDED_FOR="203.0.113.9, 1.1.1.1",
            )
            self.assertEqual(get_client_ip(req), "198.51.100.77")

        # 2. Request via trusted proxy walks X-Forwarded-For right-to-left skipping trusted proxies
        with override_settings(METROLMS_TRUSTED_PROXY_IPS=["10.0.0.0/8", "127.0.0.1"]):
            # Client prepends fake "9.9.9.9", trusted proxy appends real "192.0.2.50" + internal hop "10.0.0.5"
            req_proxied = rf.post(
                "/api/auth/login",
                REMOTE_ADDR="127.0.0.1",
                HTTP_X_FORWARDED_FOR="9.9.9.9, 192.0.2.50, 10.0.0.5",
            )
            self.assertEqual(get_client_ip(req_proxied), "192.0.2.50")

        # 3. Rotating X-Forwarded-For cannot evade per-IP lockout when REMOTE_ADDR is direct
        clear_login_failures(self.trainee_line1.phone_e164)
        with override_settings(
            METROLMS_TRUSTED_PROXY_IPS=[],
            LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10,
            LOGIN_RATE_LIMIT_IP_MAX_ATTEMPTS=3,
        ):
            client = Client()
            for idx in range(2):
                r = client.post(
                    "/api/auth/login",
                    data={"phone_e164": f"+20109999000{idx}", "password": "Wrong!"},
                    content_type="application/json",
                    REMOTE_ADDR="198.51.100.88",
                    HTTP_X_FORWARDED_FOR=f"203.0.113.{10 + idx}",
                )
                self.assertEqual(r.status_code, 401)
            r_locked = client.post(
                "/api/auth/login",
                data={"phone_e164": "+201099990099", "password": "Wrong!"},
                content_type="application/json",
                REMOTE_ADDR="198.51.100.88",
                HTTP_X_FORWARDED_FOR="203.0.113.250",
            )
            self.assertEqual(r_locked.status_code, 429)

            # A different actual client IP is unaffected
            r_other_ip = client.post(
                "/api/auth/login",
                data={"phone_e164": self.trainee_line2.phone_e164, "password": "StrongSec@2026"},
                content_type="application/json",
                REMOTE_ADDR="198.51.100.89",
            )
            self.assertEqual(r_other_ip.status_code, 200)
