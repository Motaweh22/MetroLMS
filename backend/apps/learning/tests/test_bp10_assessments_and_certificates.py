"""BP-10 integration tests: Quiz Scoring (WP55-PT-03), Versioned Certificates (D-13, TR-C3-03) & Performance."""
from __future__ import annotations

import datetime
from decimal import Decimal
import hashlib

from django.test import Client, TestCase
from django.utils import timezone

from apps.courses.models import Course, LessonItem, Module, PublishedCourseVersion, QuizDefinition
from apps.identity.models import RolePolicy, User
from apps.learning.models import CertificateRecord
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp10AssessmentsAndCertificatesTests(TestCase):
    """Verify BP-10: exact Decimal quiz thresholds, certificate issuance, PII-free verify, revoke, and performance."""

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

        self.admin = make_user("+201000000301", "29001011234581", self.role_admin, "مسؤول")
        self.lecturer = make_user("+201000000302", "29001011234582", self.role_lecturer, "محاضر")
        self.trainee = make_user("+201000000303", "29001011234583", self.role_trainee, "أحمد المتدرب")

        self.course = Course.objects.create(
            title="دورة الاختبارات والشهادات",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )
        self.pub_ver = PublishedCourseVersion.objects.create(
            course=self.course,
            version_number=1,
            published_at=now,
            published_by_user=self.lecturer,
        )
        self.module = Module.objects.create(published_version=self.pub_ver, title="الوحدة 1", sort_order=1)
        self.lesson_doc = LessonItem.objects.create(
            module=self.module, title="درس تمهيدي", lesson_type="document", sort_order=1
        )
        self.lesson_quiz = LessonItem.objects.create(
            module=self.module, title="الاختبار النهائي", lesson_type="quiz", sort_order=2
        )
        # 3 questions (1 pt each): 2/3 = 66.666...% < 67.00% -> must FAIL without pre-rounding (WP55-PT-03)
        self.quiz = QuizDefinition.objects.create(
            lesson_item=self.lesson_quiz,
            questions_json=[
                {"id": "q1", "correctIndex": 0, "points": 1},
                {"id": "q2", "correctIndex": 1, "points": 1},
                {"id": "q3", "correctIndex": 2, "points": 1},
            ],
            passing_score=Decimal("67.00"),
        )

    def test_quiz_passing_boundary_certificate_issuance_verify_and_revoke(self) -> None:
        trainee_client = Client()
        trainee_client.force_login(self.trainee)

        enr = trainee_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"sourceType": "direct"},
            content_type="application/json",
        )
        self.assertEqual(enr.status_code, 201)
        attempt_id = enr.json()["data"]["attempt"]["id"]

        # Complete lesson 1 (50%)
        trainee_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_doc.id}/complete")

        # Cannot issue certificate at 50%
        early_cert = trainee_client.post(f"/api/attempts/{attempt_id}/certificate/issue")
        self.assertEqual(early_cert.status_code, 409)
        self.assertEqual(early_cert.json()["code"], "COURSE_NOT_COMPLETED")

        # Fail quiz with 2/3 = 66.67% < 67.00% (WP55-PT-03 no pre-rounding)
        fail_quiz = trainee_client.post(
            f"/api/courses/{self.course.id}/lessons/{self.lesson_quiz.id}/quiz/submit",
            data={"answers": {"q1": 0, "q2": 1, "q3": 0}},
            content_type="application/json",
        )
        self.assertEqual(fail_quiz.status_code, 200)
        self.assertFalse(fail_quiz.json()["data"]["passed"])
        self.assertEqual(fail_quiz.json()["data"]["progress"]["progressPercent"], 50)

        # Pass quiz with 3/3 = 100%
        pass_quiz = trainee_client.post(
            f"/api/courses/{self.course.id}/lessons/{self.lesson_quiz.id}/quiz/submit",
            data={"answers": {"q1": 0, "q2": 1, "q3": 2}},
            content_type="application/json",
        )
        self.assertEqual(pass_quiz.status_code, 200)
        self.assertTrue(pass_quiz.json()["data"]["passed"])
        self.assertEqual(pass_quiz.json()["data"]["progress"]["progressPercent"], 100)

        # Issue certificate
        cert_resp = trainee_client.post(f"/api/attempts/{attempt_id}/certificate/issue")
        self.assertEqual(cert_resp.status_code, 201)
        cert_data = cert_resp.json()["data"]["certificate"]
        raw_code = cert_data["verificationCode"]
        cert_id = cert_data["id"]
        self.assertEqual(cert_data["recipientNameSnapshot"], "أحمد المتدرب")

        # Verify BINARY(32) SHA-256 hash stored
        stored_cert = CertificateRecord.objects.get(pk=cert_id)
        self.assertEqual(len(bytes(stored_cert.verification_token_hash)), 32)
        self.assertEqual(
            bytes(stored_cert.verification_token_hash),
            hashlib.sha256(raw_code.encode("utf-8")).digest(),
        )

        # Duplicate issuance returns 409
        dup_cert = trainee_client.post(f"/api/attempts/{attempt_id}/certificate/issue")
        self.assertEqual(dup_cert.status_code, 409)

        # Public PII-free verification (unauthenticated!)
        anon_client = Client()
        verify_resp = anon_client.get(f"/api/certificates/verify/{raw_code}")
        self.assertEqual(verify_resp.status_code, 200)
        vdata = verify_resp.json()["data"]
        self.assertTrue(vdata["valid"])
        self.assertEqual(vdata["status"], "Valid")
        self.assertEqual(vdata["courseVersion"], 1)
        self.assertNotIn("recipientNameSnapshot", vdata)
        self.assertNotIn("أحمد", str(vdata))

        # Lecturer course performance (trainee forbidden, lecturer allowed)
        self.assertEqual(
            trainee_client.get(f"/api/lecturer/courses/{self.course.id}/performance").status_code, 403
        )
        lec_client = Client()
        lec_client.force_login(self.lecturer)
        perf_resp = lec_client.get(f"/api/lecturer/courses/{self.course.id}/performance")
        self.assertEqual(perf_resp.status_code, 200)
        self.assertEqual(perf_resp.json()["data"]["completedCount"], 1)
        self.assertEqual(perf_resp.json()["data"]["issuedCertificates"], 1)

        # Admin revokes certificate -> public verify reflects Revoked
        admin_client = Client()
        admin_client.force_login(self.admin)
        rev_resp = admin_client.post(
            f"/api/admin/certificates/{cert_id}/revoke",
            data={"reason": "مخالفة إدارية"},
            content_type="application/json",
        )
        self.assertEqual(rev_resp.status_code, 200)
        self.assertEqual(
            admin_client.post(f"/api/admin/certificates/{cert_id}/revoke").status_code,
            409,
        )

        verify_revoked = anon_client.get(f"/api/certificates/verify/{raw_code}")
        self.assertEqual(verify_revoked.status_code, 200)
        self.assertFalse(verify_revoked.json()["data"]["valid"])
        self.assertEqual(verify_revoked.json()["data"]["status"], "Revoked")

