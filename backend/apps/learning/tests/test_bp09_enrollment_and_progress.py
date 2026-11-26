"""BP-09 integration tests: Multi-source Enrollment, D-06 Attempt Isolation, D-07 Removal & D-12 Rounding."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.courses.models import Course, LessonItem, Module, PublishedCourseVersion
from apps.groups.models import TrainingGroup
from apps.identity.models import RolePolicy, User
from apps.learning.models import CourseAttempt, Enrollment, EnrollmentSourceGrant, LessonProgress
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp09EnrollmentAndProgressTests(TestCase):
    """Verify BP-09: multi-source grants, D-07 preservation, telemetry, D-12 rounding, and D-06 attempt isolation."""

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

        self.admin = make_user("+201000000201", "29001011234571", self.role_admin, "مسؤول")
        self.lecturer = make_user("+201000000202", "29001011234572", self.role_lecturer, "محاضر")
        self.trainee = make_user("+201000000203", "29001011234573", self.role_trainee, "متدرب")

        self.course = Course.objects.create(
            title="دورة السلامة المتقدمة",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            access_mode="all_trainees",
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
        self.module = Module.objects.create(
            published_version=self.pub_ver,
            title="الوحدة الأولى",
            sort_order=1,
        )
        self.lesson_1 = LessonItem.objects.create(
            module=self.module, title="الدرس 1", lesson_type="video", sort_order=1, duration_seconds=120
        )
        self.lesson_2 = LessonItem.objects.create(
            module=self.module, title="الدرس 2", lesson_type="video", sort_order=2, duration_seconds=180
        )
        self.lesson_3 = LessonItem.objects.create(
            module=self.module, title="الدرس 3", lesson_type="document", sort_order=3, duration_seconds=0
        )
        self.group = TrainingGroup.objects.create(
            name="مجموعة التشغيل 1",
            group_type="regular",
            is_archived=False,
            auto_renewal_enabled=False,
        )

    def test_multi_source_enrollment_and_d07_group_removal_preserves_progress(self) -> None:
        admin_client = Client()
        admin_client.force_login(self.admin)

        # Enroll via group
        r1 = admin_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"userId": self.trainee.id, "sourceType": "group", "trainingGroupId": self.group.id},
            content_type="application/json",
        )
        self.assertEqual(r1.status_code, 201)

        # Complete lesson 1 as trainee
        trainee_client = Client()
        trainee_client.force_login(self.trainee)
        c1 = trainee_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_1.id}/complete")
        self.assertEqual(c1.status_code, 200)
        self.assertEqual(c1.json()["data"]["progress"]["progressPercent"], 33)

        # Revoke group grant WITHOUT self:continued -> access revoked (403) but progress preserved!
        rev1 = admin_client.delete(
            f"/api/courses/{self.course.id}/enrollments/{self.trainee.id}/group-grant",
            data={"trainingGroupId": self.group.id, "convertToSelfContinued": False},
            content_type="application/json",
        )
        self.assertEqual(rev1.status_code, 200)
        self.assertFalse(rev1.json()["data"]["hasActiveAccess"])
        self.assertEqual(LessonProgress.objects.filter(course_attempt__enrollment__user=self.trainee).count(), 1)

        blocked = trainee_client.get(f"/api/courses/{self.course.id}/progress")
        self.assertEqual(blocked.status_code, 403)
        self.assertEqual(blocked.json()["code"], "ACCESS_REVOKED")

        # Re-enroll via group + revoke WITH convertToSelfContinued=True -> retains access via self:continued
        admin_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"userId": self.trainee.id, "sourceType": "group", "trainingGroupId": self.group.id},
            content_type="application/json",
        )
        rev2 = admin_client.delete(
            f"/api/courses/{self.course.id}/enrollments/{self.trainee.id}/group-grant",
            data={"trainingGroupId": self.group.id, "convertToSelfContinued": True},
            content_type="application/json",
        )
        self.assertEqual(rev2.status_code, 200)
        self.assertTrue(rev2.json()["data"]["hasActiveAccess"])
        self.assertTrue(
            EnrollmentSourceGrant.objects.filter(
                enrollment__user=self.trainee, source_type="self:continued"
            ).exists()
        )
        restored = trainee_client.get(f"/api/courses/{self.course.id}/progress")
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.json()["data"]["progress"]["progressPercent"], 33)

    def test_telemetry_rounding_d12_and_d06_attempt_isolation(self) -> None:
        trainee_client = Client()
        trainee_client.force_login(self.trainee)

        # Self-enroll (direct)
        enr_resp = trainee_client.post(
            f"/api/courses/{self.course.id}/enrollments",
            data={"sourceType": "direct"},
            content_type="application/json",
        )
        self.assertEqual(enr_resp.status_code, 201)

        # Playback telemetry: monotonic furthestWatched, no invented auto-completion
        act1 = trainee_client.post(
            f"/api/courses/{self.course.id}/lessons/{self.lesson_1.id}/activity",
            data={
                "lastPositionSeconds": 90,
                "furthestWatchedSeconds": 90,
                "eligibleDeltaSeconds": 90,
                "incrementWatchCount": True,
            },
            content_type="application/json",
        )
        self.assertEqual(act1.status_code, 200)
        self.assertFalse(act1.json()["data"]["lessonProgress"]["isCompleted"])
        self.assertEqual(act1.json()["data"]["lessonProgress"]["watchCount"], 1)

        # Rewind to 30s -> furthestWatched stays 90s, eligible accumulates to 110s
        act2 = trainee_client.post(
            f"/api/courses/{self.course.id}/lessons/{self.lesson_1.id}/activity",
            data={"lastPositionSeconds": 30, "furthestWatchedSeconds": 30, "eligibleDeltaSeconds": 20},
            content_type="application/json",
        )
        self.assertEqual(act2.status_code, 200)
        self.assertEqual(act2.json()["data"]["lessonProgress"]["furthestWatchedSeconds"], 90)
        self.assertEqual(act2.json()["data"]["lessonProgress"]["eligibleViewingSeconds"], 110)

        # D-12 rounding: 1/3 -> 33, 2/3 -> 67, 3/3 -> 100
        self.assertEqual(
            trainee_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_1.id}/complete")
            .json()["data"]["progress"]["progressPercent"],
            33,
        )
        self.assertEqual(
            trainee_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_2.id}/complete")
            .json()["data"]["progress"]["progressPercent"],
            67,
        )
        self.assertEqual(
            trainee_client.post(f"/api/courses/{self.course.id}/lessons/{self.lesson_3.id}/complete")
            .json()["data"]["progress"]["progressPercent"],
            100,
        )

        # D-06 Attempt isolation: start attempt 2 -> seals attempt 1 (100%), attempt 2 starts at 0%
        new_att = trainee_client.post(
            f"/api/users/{self.trainee.id}/courses/{self.course.id}/attempts",
            data={},
            content_type="application/json",
        )
        self.assertEqual(new_att.status_code, 201)
        self.assertEqual(new_att.json()["data"]["attempt"]["progress"]["progressPercent"], 0)
        self.assertFalse(new_att.json()["data"]["attempt"]["isSealed"])

        attempts_list = trainee_client.get(
            f"/api/users/{self.trainee.id}/courses/{self.course.id}/attempts"
        ).json()["data"]["attempts"]
        self.assertEqual(len(attempts_list), 2)
        self.assertTrue(attempts_list[0]["isSealed"])
        self.assertEqual(attempts_list[0]["progress"]["progressPercent"], 100)
        self.assertFalse(attempts_list[1]["isSealed"])
        self.assertEqual(attempts_list[1]["progress"]["progressPercent"], 0)

        # My enrollments endpoint reflects active enrollment
        my_enr = trainee_client.get("/api/enrollments/my")
        self.assertEqual(my_enr.status_code, 200)
        self.assertEqual(len(my_enr.json()["data"]["enrollments"]), 1)

    def test_d12_strict_100_percent_gate_caps_99_point_6_at_99(self) -> None:
        # Create a course with 201 lessons, complete 200 -> 200/201 = 99.502% -> must cap at 99%
        now = timezone.now()
        big_course = Course.objects.create(
            title="دورة كبيرة",
            course_type="main",
            primary_lecturer=self.lecturer,
            lifecycle_status="Published",
            created_by_user=self.lecturer,
            created_at=now,
            updated_at=now,
        )
        pub = PublishedCourseVersion.objects.create(
            course=big_course, version_number=1, published_at=now, published_by_user=self.lecturer
        )
        mod = Module.objects.create(published_version=pub, title="وحدة", sort_order=1)
        LessonItem.objects.bulk_create(
            [LessonItem(module=mod, title=f"درس {i}", lesson_type="document", sort_order=i) for i in range(1, 202)]
        )
        lessons = list(LessonItem.objects.filter(module=mod).order_by("id"))
        enr = Enrollment.objects.create(user=self.trainee, course=big_course, enrolled_at=now)
        EnrollmentSourceGrant.objects.create(enrollment=enr, source_type="direct")
        att = CourseAttempt.objects.create(enrollment=enr, published_version=pub, is_sealed=False)
        LessonProgress.objects.bulk_create(
            [
                LessonProgress(course_attempt=att, lesson_item_id=l.id, is_completed=True, updated_at=now)
                for l in lessons[:200]
            ]
        )

        client = Client()
        client.force_login(self.trainee)
        resp = client.get(f"/api/courses/{big_course.id}/progress")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["data"]["progress"]["completedLessons"], 200)
        self.assertEqual(resp.json()["data"]["progress"]["totalLessons"], 201)
        self.assertEqual(resp.json()["data"]["progress"]["progressPercent"], 99)

