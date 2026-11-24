"""BP-11 integration tests: Notifications (D-08), WhatsApp (D-09), TR-C3-04 Idempotency, Retry 0..2 & Cairo DST."""
from __future__ import annotations

import datetime
from datetime import timedelta
from io import StringIO
import json

from django.core.management import call_command
from django.test import Client, TestCase
from django.utils import timezone

from apps.communications.models import ScheduledJobRun, WhatsAppContact
from apps.communications.services.communications_service import send_notification
from apps.courses.models import Course
from apps.groups.models import GroupRenewalCycle, TrainingGroup
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from infrastructure.scheduling.job_runner import (
    get_cairo_bucket_key,
    run_scheduled_job_with_idempotency,
)
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp11CommunicationsAndSchedulingTests(TestCase):
    """Verify BP-11: notifications, WhatsApp visibility, Cairo DST bucket keys, TR-C3-04 idempotency & retries."""

    def setUp(self) -> None:
        now = timezone.now()
        self.role_admin = RolePolicy.objects.create(
            role_key="admin",
            default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES["admin"]),
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

        self.admin = make_user("+201000000501", "29001011234591", self.role_admin, "مسؤول")
        self.lecturer = make_user("+201000000502", "29001011234592", self.role_lecturer, "محاضر")
        self.trainee = make_user("+201000000503", "29001011234593", self.role_trainee, "متدرب")

        self.course = Course.objects.create(
            title="دورة الدعم الفني",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )

    def test_notifications_and_whatsapp_contacts_visibility(self) -> None:
        n1 = send_notification(user=self.trainee, title="تذكير", body="يرجى إكمال الدرس الأول")
        n2 = send_notification(user=self.trainee, title="إعلان", body="تم نشر تحديث جديد")

        t_client = Client()
        t_client.force_login(self.trainee)

        list_resp = t_client.get("/api/notifications")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(list_resp.json()["data"]["unreadCount"], 2)

        # Cross-user isolation: admin cannot read-mark trainee's notification
        a_client = Client()
        a_client.force_login(self.admin)
        self.assertEqual(a_client.post(f"/api/notifications/{n1.id}/read").status_code, 404)

        # Mark one read, then read-all
        self.assertEqual(t_client.post(f"/api/notifications/{n1.id}/read").status_code, 200)
        self.assertEqual(t_client.get("/api/notifications?unreadOnly=true").json()["data"]["unreadCount"], 1)
        self.assertEqual(t_client.post("/api/notifications/read-all").json()["data"]["markedRead"], 1)
        self.assertEqual(t_client.get("/api/notifications").json()["data"]["unreadCount"], 0)

        # Course WhatsApp contacts (D-09)
        l_client = Client()
        l_client.force_login(self.lecturer)
        bad_phone = l_client.post(
            f"/api/courses/{self.course.id}/whatsapp-contacts",
            data={"phoneE164": "01012345678", "label": "دعم"},
            content_type="application/json",
        )
        self.assertEqual(bad_phone.status_code, 400)

        ok_contact = l_client.post(
            f"/api/courses/{self.course.id}/whatsapp-contacts",
            data={"phoneE164": "+201012345678", "label": "دعم المحاضر"},
            content_type="application/json",
        )
        self.assertEqual(ok_contact.status_code, 201)
        contact_id = ok_contact.json()["data"]["contact"]["id"]
        # Draft course blocks trainee IDOR access to WhatsApp contacts
        self.assertEqual(t_client.get(f"/api/courses/{self.course.id}/whatsapp-contacts").status_code, 403)
        self.course.lifecycle_status = "Published"
        self.course.access_mode = "all_trainees"
        self.course.save(update_fields=["lifecycle_status", "access_mode"])
        self.assertEqual(len(t_client.get(f"/api/courses/{self.course.id}/whatsapp-contacts").json()["data"]["contacts"]), 1)

        # Hide course_support visibility for trainee
        vis_resp = a_client.put(
            f"/api/admin/users/{self.trainee.id}/whatsapp-visibility",
            data={"scenarioKey": "course_support", "isVisible": False},
            content_type="application/json",
        )
        self.assertEqual(vis_resp.status_code, 200)
        hidden = t_client.get(f"/api/courses/{self.course.id}/whatsapp-contacts").json()["data"]
        self.assertFalse(hidden["visible"])
        self.assertEqual(hidden["contacts"], [])

        # Delete contact & public support endpoint
        self.assertEqual(
            l_client.delete(f"/api/courses/{self.course.id}/whatsapp-contacts/{contact_id}").status_code,
            200,
        )
        self.assertEqual(WhatsAppContact.objects.filter(course=self.course).count(), 0)
        self.assertTrue(Client().get("/api/public/support-contacts").json()["data"]["visible"])

    def test_cairo_dst_buckets_idempotency_retry_limits_and_due_renewals(self) -> None:
        # Cairo winter (UTC+2) vs summer DST (UTC+3)
        winter_utc = datetime.datetime(2026, 1, 15, 10, 0, tzinfo=datetime.timezone.utc)
        summer_utc = datetime.datetime(2026, 7, 15, 10, 0, tzinfo=datetime.timezone.utc)
        self.assertIn("+0200", get_cairo_bucket_key(winter_utc))
        self.assertIn("+0300", get_cairo_bucket_key(summer_utc))

        # Idempotency check
        calls = {"count": 0}

        def succeed_once():
            calls["count"] += 1
            return {"ok": True}

        r1 = run_scheduled_job_with_idempotency(
            job_key="test_job", idempotency_key="key-ok-1", fn=succeed_once
        )
        r2 = run_scheduled_job_with_idempotency(
            job_key="test_job", idempotency_key="key-ok-1", fn=succeed_once
        )
        self.assertEqual(r1.status, "Succeeded")
        self.assertEqual(r2.id, r1.id)
        self.assertEqual(calls["count"], 1)

        # Retry bounds 0..2
        def always_fail():
            raise RuntimeError("transient sql error")

        f0 = run_scheduled_job_with_idempotency(job_key="fail_job", idempotency_key="key-fail-1", fn=always_fail)
        f1 = run_scheduled_job_with_idempotency(job_key="fail_job", idempotency_key="key-fail-1", fn=always_fail)
        f2 = run_scheduled_job_with_idempotency(job_key="fail_job", idempotency_key="key-fail-1", fn=always_fail)
        f3 = run_scheduled_job_with_idempotency(job_key="fail_job", idempotency_key="key-fail-1", fn=always_fail)
        self.assertEqual((f0.retry_count, f1.retry_count, f2.retry_count, f3.retry_count), (0, 1, 2, 2))
        self.assertEqual(f3.status, "Failed")

        # Management command: process_due_group_renewals
        past = timezone.now() - timedelta(days=1)
        due_grp = TrainingGroup.objects.create(
            name="مجموعة مستحقة للتجديد",
            group_type="reminder",
            is_archived=False,
            auto_renewal_enabled=True,
            interval_days=30,
            deadline_datetime=past,
            next_scheduled_renewal_date=past,
        )
        GroupRenewalCycle.objects.create(
            training_group=due_grp,
            cycle_code=f"CYC-{due_grp.id}-01",
            cycle_number=1,
            start_datetime=past - timedelta(days=30),
            deadline_datetime=past,
            cycle_status="Active",
        )

        out1 = StringIO()
        call_command("process_due_group_renewals", stdout=out1)
        res1 = json.loads(out1.getvalue())
        self.assertEqual(res1["status"], "Succeeded")
        self.assertIn(due_grp.id, res1["details"]["renewedGroupIds"])
        self.assertTrue(
            GroupRenewalCycle.objects.filter(training_group=due_grp, cycle_code=f"CYC-{due_grp.id}-02").exists()
        )

        # Second invocation in same 6h Cairo bucket is idempotent (no duplicate renewal)
        out2 = StringIO()
        call_command("process_due_group_renewals", stdout=out2)
        res2 = json.loads(out2.getvalue())
        self.assertEqual(res2["status"], "Succeeded")
        self.assertEqual(
            ScheduledJobRun.objects.filter(job__job_key="process_due_group_renewals").count(),
            1,
        )

    def test_admin_and_lecturer_notifications_end_to_end(self) -> None:
        lec_client = Client()
        lec_client.force_login(self.lecturer)
        adm_client = Client()
        adm_client.force_login(self.admin)
        trn_client = Client()
        trn_client.force_login(self.trainee)

        # 1. Lecturer creates & submits course -> Admin receives content_pending_review
        c_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة الإشعارات الجديدة", "courseType": "main", "description": "وصف متكامل"},
            content_type="application/json",
        )
        self.assertEqual(c_res.status_code, 201)
        cid = c_res.json()["data"]["course"]["id"]
        sub_res = lec_client.post(f"/api/admin/courses/{cid}/review/submit", data={}, content_type="application/json")
        self.assertEqual(sub_res.status_code, 201)

        adm_notifs = adm_client.get("/api/notifications").json()["data"]["notifications"]
        pending_notifs = [n for n in adm_notifs if n["type"] == "content_pending_review" and n["courseId"] == str(cid)]
        self.assertEqual(len(pending_notifs), 1)
        self.assertTrue(pending_notifs[0]["actionRequired"])
        self.assertEqual(pending_notifs[0]["targetUrl"], f"/admin/review/{cid}")

        # 2. Admin rejects/returns course -> Lecturer receives content_rejected
        rej_res = adm_client.post(
            f"/api/admin/review/{cid}/decision",
            data={"outcome": "rejected", "summaryMessage": "يرجى إضافة مراجع"},
            content_type="application/json",
        )
        self.assertEqual(rej_res.status_code, 200)
        lec_notifs = lec_client.get("/api/notifications").json()["data"]["notifications"]
        rej_notifs = [n for n in lec_notifs if n["type"] == "content_rejected" and n["courseId"] == str(cid)]
        self.assertEqual(len(rej_notifs), 1)
        self.assertEqual(rej_notifs[0]["targetUrl"], f"/lecturer/builder/{cid}")
        self.assertTrue(rej_notifs[0]["actionRequired"])

        # 3. Resubmit & Approve -> Lecturer receives content_approved
        self.assertEqual(
            lec_client.post(f"/api/admin/courses/{cid}/review/submit", data={}, content_type="application/json").status_code,
            201,
        )
        app_res = adm_client.post(
            f"/api/admin/review/{cid}/decision",
            data={"outcome": "approved", "approvalNote": "ممتاز"},
            content_type="application/json",
        )
        self.assertEqual(app_res.status_code, 200)
        lec_notifs2 = lec_client.get("/api/notifications").json()["data"]["notifications"]
        app_notifs = [n for n in lec_notifs2 if n["type"] == "content_approved" and n["courseId"] == str(cid)]
        self.assertEqual(len(app_notifs), 1)
        self.assertEqual(app_notifs[0]["targetUrl"], f"/courses/{cid}")

        # 4. Comment on published self.course -> Lecturer gets new_comment; Report -> Admin gets comment_reported
        self.course.access_mode = "all_trainees"
        self.course.save(update_fields=["access_mode"])
        cmt_res = trn_client.post(
            f"/api/courses/{self.course.id}/comments",
            data={"body": "ملاحظة على الدرس"},
            content_type="application/json",
        )
        self.assertEqual(cmt_res.status_code, 201)
        cmt_id = cmt_res.json()["data"]["comment"]["id"]

        # Self-reporting own comment is strictly prohibited
        self_rep = trn_client.post(
            f"/api/comments/{cmt_id}/report",
            data={"reason": "inappropriate_content"},
            content_type="application/json",
        )
        self.assertEqual(self_rep.status_code, 400)
        self.assertEqual(self_rep.json()["code"], "SELF_REPORT_PROHIBITED")

        # Another user (lecturer) reports the comment with preset reason + custom notes
        rep_res = lec_client.post(
            f"/api/comments/{cmt_id}/report",
            data={"reason": "misinformation", "notes": "المعلومة غير مطابقة لتعليمات التشغيل"},
            content_type="application/json",
        )
        self.assertEqual(rep_res.status_code, 201)
        rep_data = rep_res.json()["data"]
        self.assertTrue(rep_data["reported"])
        self.assertEqual(rep_data["reportReason"], "misinformation")
        self.assertEqual(rep_data["reportReasonLabelAr"], "معلومات خاطئة")
        self.assertEqual(rep_data["reportNotes"], "المعلومة غير مطابقة لتعليمات التشغيل")

        lec_cmt_notifs = [
            n
            for n in lec_client.get("/api/notifications").json()["data"]["notifications"]
            if n["type"] == "new_comment" and n["commentId"] == str(cmt_id)
        ]
        self.assertEqual(len(lec_cmt_notifs), 1)

        adm_rep_notifs = [
            n
            for n in adm_client.get("/api/notifications").json()["data"]["notifications"]
            if n["type"] == "comment_reported" and n["commentId"] == str(cmt_id)
        ]
        self.assertEqual(len(adm_rep_notifs), 1)
        self.assertEqual(adm_rep_notifs[0]["targetUrl"], "/admin/comment-moderation")
        self.assertTrue(adm_rep_notifs[0]["actionRequired"])
        self.assertIn("معلومات خاطئة", adm_rep_notifs[0]["body"])
        self.assertIn("المعلومة غير مطابقة لتعليمات التشغيل", adm_rep_notifs[0]["body"])
        self.assertEqual(adm_rep_notifs[0]["metadata"]["reportReasonLabelAr"], "معلومات خاطئة")
        self.assertEqual(adm_rep_notifs[0]["metadata"]["reportNotes"], "المعلومة غير مطابقة لتعليمات التشغيل")

        # Admin reported-comments queue & summary reflect reason, notes, and reporter
        reported_list = adm_client.get("/api/admin/comments/reported").json()["data"]
        self.assertEqual(len(reported_list), 1)
        self.assertEqual(reported_list[0]["reportReason"], "misinformation")
        self.assertEqual(reported_list[0]["reportReasonLabelAr"], "معلومات خاطئة")
        self.assertEqual(reported_list[0]["reportNotes"], "المعلومة غير مطابقة لتعليمات التشغيل")
        self.assertEqual(reported_list[0]["reportedByName"], self.lecturer.full_name)

        summary = adm_client.get("/api/admin/comments/summary").json()["data"]
        self.assertEqual(summary["reportedCommentsCount"], 1)

