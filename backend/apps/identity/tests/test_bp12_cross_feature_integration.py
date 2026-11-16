"""BP-12 Cross-Feature Integration & Hardening Tests (D-01 cascade, group->attempt, publish->attempt, OD-PF-01)."""
from __future__ import annotations

import datetime
from datetime import timedelta
from io import StringIO
import json

from django.core.management import call_command
from django.test import Client, TestCase
from django.utils import timezone

from apps.communications.models import NotificationItem, UserWhatsAppVisibility
from apps.communications.services.communications_service import send_notification, set_user_whatsapp_visibility
from apps.courses.models import (
    Course,
    CourseComment,
    CourseCommentReport,
    LessonItem,
    Module,
    PublishedCourseVersion,
)
from apps.governance.models import AuditLogEntry
from apps.governance.services.governance_service import record_audit_log
from apps.groups.models import GroupJoinRequest, GroupMembership, GroupRenewalCycle, TrainingGroup
from apps.identity.models import DeletedUserTombstone, RolePolicy, User
from apps.learning.models import (
    CertificateRecord,
    CourseAttempt,
    Enrollment,
    LessonProgress,
)
from apps.organization.models import (
    HistoricalServiceTrainingRecord,
    MaritalStatusCatalog,
    MetroLine,
    MilitaryServiceStatusCatalog,
)
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp12CrossFeatureIntegrationTests(TestCase):
    """Verify end-to-end cross-Feature transactions across all 8 MetroLMS Features on SQL Server."""

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
        self.marital = MaritalStatusCatalog.objects.create(code="single", name_ar="أعزب")
        self.military = MilitaryServiceStatusCatalog.objects.create(code="completed", name_ar="أنهى الخدمة")
        self.metro_line = MetroLine.objects.create(name_ar="الخط الأول")

        def make_user(phone: str, nid: str, role_policy: RolePolicy, name: str, email: str | None = None) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="TestPassword@123",
                role=role_policy,
                full_name=name,
                national_id=nid,
                email=email,
                marital_status=self.marital,
                appointment_date=datetime.date(2020, 1, 1),
                military_service_status=self.military,
                educational_qualification="بكالوريوس",
                address="القاهرة",
                date_of_birth=datetime.date(1995, 1, 1),
                metro_line=self.metro_line,
            )

        self.dev = make_user("+201000000600", "29001011234600", self.role_dev, "المطور")
        self.admin = make_user("+201000000601", "29001011234601", self.role_admin, "مسؤول")
        self.lecturer = make_user("+201000000602", "29001011234602", self.role_lecturer, "محاضر")
        self.trainee = make_user(
            "+201000000603", "29001011234603", self.role_trainee, "متدرب متكامل", email="trainee.d01@metro.eg"
        )

        self.course = Course.objects.create(
            title="دورة التكامل الشاملة",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )
        self.pub_v1 = PublishedCourseVersion.objects.create(
            course=self.course,
            version_number=1,
            published_at=now,
            published_by_user=self.lecturer,
        )
        self.mod_v1 = Module.objects.create(published_version=self.pub_v1, title="وحدة 1", sort_order=1)
        self.lesson_v1 = LessonItem.objects.create(
            module=self.mod_v1, title="درس 1", lesson_type="document", sort_order=1
        )

    def test_d01_user_deletion_cascade_across_all_8_features_and_email_reuse(self) -> None:
        now = timezone.now()
        # Populate records across organization, governance, courses, groups, learning, communications
        HistoricalServiceTrainingRecord.objects.create(
            user=self.trainee,
            course_name="سجل تدريب تاريخي",
            providing_organization="معهد التدريب",
            completion_date=datetime.date(2023, 5, 1),
        )
        record_audit_log(
            action="trainee.test_event",
            actor=self.trainee,
            target_entity_type="User",
            target_entity_id=str(self.trainee.id),
        )
        comment = CourseComment.objects.create(
            course=self.course, author_user=self.trainee, body="تعليق مفيد", created_at=now
        )
        report = CourseCommentReport.objects.create(
            comment=comment, reporter_user=self.trainee, reason="بلاغ تجريبي", status="Pending", created_at=now
        )
        group = TrainingGroup.objects.create(
            name="مجموعة التكامل", group_type="regular", is_archived=False, auto_renewal_enabled=False
        )
        GroupMembership.objects.create(training_group=group, user=self.trainee, joined_at=now)
        GroupJoinRequest.objects.create(
            training_group=group, user=self.trainee, request_status="Approved", requested_at=now, decided_at=now
        )
        send_notification(user=self.trainee, title="إشعار", body="مرحبًا")
        set_user_whatsapp_visibility(user=self.trainee, scenario_key="course_support", is_visible=False)

        # Enroll, complete 100%, and issue CertificateRecord
        t_client = Client()
        t_client.force_login(self.trainee)
        enr = t_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"sourceType": "direct"},
            content_type="application/json",
        )
        attempt_id = enr.json()["data"]["attempt"]["id"]
        t_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_v1.id}/complete")
        cert_resp = t_client.post(f"/api/attempts/{attempt_id}/certificate/issue")
        raw_code = cert_resp.json()["data"]["certificate"]["verificationCode"]
        cert_id = cert_resp.json()["data"]["certificate"]["id"]

        # Admin cannot delete developer (INV-R8 -> 404)
        a_client = Client()
        a_client.force_login(self.admin)
        self.assertEqual(a_client.delete(f"/api/admin/users/{self.dev.id}").status_code, 404)

        # Delete trainee via D-01 cascade
        del_resp = a_client.delete(
            f"/api/admin/users/{self.trainee.id}",
            data={"reason": "انتهاء الخدمة"},
            content_type="application/json",
        )
        self.assertEqual(del_resp.status_code, 200)
        tombstone_id = del_resp.json()["data"]["tombstoneId"]
        tombstone = DeletedUserTombstone.objects.get(pk=tombstone_id)

        # User deleted; owned rows deleted
        self.assertFalse(User.objects.filter(pk=self.trainee.id).exists())
        self.assertEqual(Enrollment.objects.filter(user_id=self.trainee.id).count(), 0)
        self.assertEqual(CourseAttempt.objects.filter(enrollment__user_id=self.trainee.id).count(), 0)
        self.assertEqual(LessonProgress.objects.filter(course_attempt__enrollment__user_id=self.trainee.id).count(), 0)
        self.assertEqual(NotificationItem.objects.filter(user_id=self.trainee.id).count(), 0)
        self.assertEqual(UserWhatsAppVisibility.objects.filter(user_id=self.trainee.id).count(), 0)
        self.assertEqual(GroupMembership.objects.filter(user_id=self.trainee.id).count(), 0)
        self.assertEqual(GroupJoinRequest.objects.filter(user_id=self.trainee.id).count(), 0)

        # Preserved records bound to Tombstone / NULL
        comment.refresh_from_db()
        report.refresh_from_db()
        self.assertIsNone(comment.author_user)
        self.assertTrue(comment.is_author_deleted)
        self.assertIsNone(report.reporter_user)
        self.assertTrue(HistoricalServiceTrainingRecord.objects.filter(tombstone=tombstone).exists())
        self.assertTrue(AuditLogEntry.objects.filter(actor_user_id=str(self.trainee.id)).exists())

        # CertificateRecord preserved and STILL publicly verifiable!
        cert = CertificateRecord.objects.get(pk=cert_id)
        self.assertIsNone(cert.course_attempt_id)
        self.assertEqual(cert.recipient_name_snapshot, "متدرب متكامل")
        verify = Client().get(f"/api/certificates/verify/{raw_code}")
        self.assertEqual(verify.status_code, 200)
        self.assertTrue(verify.json()["data"]["valid"])

        # OD-PF-01: Deleted user's email & phone_e164 can be reused immediately
        reused = User.objects.create_user(
            phone_e164="+201000000603",
            password="TestPassword@123",
            role=self.role_trainee,
            full_name="متدرب جديد",
            national_id="29001011234603",
            email="trainee.d01@metro.eg",
            marital_status=self.marital,
            appointment_date=datetime.date(2021, 1, 1),
            military_service_status=self.military,
            educational_qualification="بكالوريوس",
            address="الجيزة",
            date_of_birth=datetime.date(1996, 1, 1),
            metro_line=self.metro_line,
        )
        self.assertIsNotNone(reused.id)

    def test_group_renewal_and_course_publish_v2_attempt_isolation(self) -> None:
        now = timezone.now()
        past = now - timedelta(days=1)
        rem_group = TrainingGroup.objects.create(
            name="مجموعة التجديد الدورية",
            group_type="reminder",
            is_archived=False,
            auto_renewal_enabled=True,
            interval_days=30,
            deadline_datetime=past,
            next_scheduled_renewal_date=past,
        )
        cyc1 = GroupRenewalCycle.objects.create(
            training_group=rem_group,
            cycle_code=f"CYC-{rem_group.id}-01",
            cycle_number=1,
            start_datetime=past - timedelta(days=30),
            deadline_datetime=past,
            cycle_status="Active",
        )

        # Enroll trainee in v1 + cyc1, complete lesson_v1
        t_client = Client()
        t_client.force_login(self.trainee)
        enr1 = t_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"sourceType": "group", "trainingGroupId": rem_group.id, "groupRenewalCycleId": cyc1.id},
            content_type="application/json",
        )
        att1_id = enr1.json()["data"]["attempt"]["id"]
        t_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_v1.id}/complete")

        # Publish v2 of the course + run due group renewals
        pub_v2 = PublishedCourseVersion.objects.create(
            course=self.course,
            version_number=2,
            published_at=now,
            published_by_user=self.lecturer,
        )
        mod_v2 = Module.objects.create(published_version=pub_v2, title="وحدة 2", sort_order=1)
        LessonItem.objects.create(module=mod_v2, title="درس 2.1", lesson_type="document", sort_order=1)

        out = StringIO()
        call_command("process_due_group_renewals", stdout=out)
        self.assertEqual(json.loads(out.getvalue())["status"], "Succeeded")
        cyc2 = GroupRenewalCycle.objects.get(training_group=rem_group, cycle_number=2)

        # Start new attempt for cyc2 -> binds to pub_v2 while att1 remains isolated on pub_v1 at 100%!
        new_att = t_client.post(
            f"/api/users/{self.trainee.id}/courses/{self.course.id}/attempts",
            data={"groupRenewalCycleId": cyc2.id},
            content_type="application/json",
        )
        self.assertEqual(new_att.status_code, 201)
        att2 = new_att.json()["data"]["attempt"]
        self.assertEqual(att2["publishedVersionId"], pub_v2.id)
        self.assertEqual(att2["groupRenewalCycleId"], cyc2.id)
        self.assertEqual(att2["progress"]["progressPercent"], 0)

        att1_obj = CourseAttempt.objects.get(pk=att1_id)
        self.assertTrue(att1_obj.is_sealed)
        self.assertEqual(att1_obj.published_version_id, self.pub_v1.id)
