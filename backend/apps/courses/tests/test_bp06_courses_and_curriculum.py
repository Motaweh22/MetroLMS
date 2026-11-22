"""BP-06 integration tests: Course lifecycle, TR-C2-01/02, Rule B publish, OD-PF-07, audience & D-02."""
from __future__ import annotations

import datetime

from django.test import Client, TestCase
from django.utils import timezone

from apps.courses.models import (
    CourseAudienceMetroLine,
    CourseReviewSubmission,
    LessonItem,
    Module,
    PublishedCourseVersion,
    QuizDefinition,
    WorkingNote,
)
from apps.courses.services.course_service import anonymize_user_comments
from apps.identity.models import RolePolicy, User
from apps.organization.models import MaritalStatusCatalog, MetroLine, MilitaryServiceStatusCatalog
from shared.permissions import ROLE_DEFAULT_CAPABILITIES


class Bp06CoursesAndCurriculumTests(TestCase):
    """Verify Course creation, TR-C2-01, Rule B snapshotting, OD-PF-07, audience OR-filter & D-02."""

    def setUp(self) -> None:
        now = timezone.now()
        self.roles = {}
        for rk in ("admin", "assistant_admin", "lecturer", "trainee"):
            self.roles[rk] = RolePolicy.objects.create(
                role_key=rk,
                default_capabilities_json=sorted(ROLE_DEFAULT_CAPABILITIES[rk]),
                updated_at=now,
                updated_by="system",
            )
        self.marital = MaritalStatusCatalog.objects.get_or_create(code="single", defaults={"name_ar": "أعزب"})[0]
        self.military = MilitaryServiceStatusCatalog.objects.get_or_create(code="completed", defaults={"name_ar": "أنهى الخدمة"})[0]
        self.line1 = MetroLine.objects.get_or_create(name_ar="الخط الأول")[0]
        self.line2 = MetroLine.objects.get_or_create(name_ar="الخط الثاني")[0]

        def make_user(phone: str, nid: str, rk: str, name: str, line: MetroLine) -> User:
            return User.objects.create_user(
                phone_e164=phone,
                password="TestPassword@123",
                role=self.roles[rk],
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

        self.admin = make_user("+201000000301", "29501010104001", "admin", "مدير", self.line1)
        self.assistant = make_user("+201000000302", "29501010104002", "assistant_admin", "مساعد", self.line1)
        self.lecturer = make_user("+201000000303", "29501010104003", "lecturer", "محاضر", self.line1)
        self.trainee1 = make_user("+201000000304", "29501010104004", "trainee", "متدرب 1", self.line1)
        self.trainee2 = make_user("+201000000305", "29501010104005", "trainee", "متدرب 2", self.line2)

    def _login(self, phone: str) -> Client:
        c = Client()
        res = c.post(
            "/api/auth/login",
            data={"phone_e164": phone, "password": "TestPassword@123"},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return c

    def test_course_draft_review_publish_and_audience_visibility(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        admin_client = self._login(self.admin.phone_e164)
        asst_client = self._login(self.assistant.phone_e164)

        # Create Main Course without description initially (Draft allows NULL)
        c_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "  إشارات المترو  ", "courseType": "main"},
            content_type="application/json",
        )
        self.assertEqual(c_res.status_code, 201)
        course_id = c_res.json()["data"]["course"]["id"]

        # TR-C2-02: assistant_admin has NO implicit draft edit access (403)
        bad_draft = asst_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={"titleSnapshot": "تعديل غير مصرح", "modules": []},
            content_type="application/json",
        )
        self.assertEqual(bad_draft.status_code, 403)

        # Lecturer saves draft curriculum with module + lesson + quiz
        draft_res = lec_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={
                "titleSnapshot": "إشارات المترو المحدثة",
                "modules": [
                    {
                        "title": "الوحدة الأولى",
                        "sortOrder": 1,
                        "lessons": [
                            {
                                "title": "الدرس الأول",
                                "lessonType": "quiz",
                                "sortOrder": 1,
                                "durationSeconds": 300,
                                "quiz": {"questions": [{"q": "س1"}], "passingScore": "80.00"},
                            }
                        ],
                    }
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_res.status_code, 200)

        # OD-PF-07: Submitting without description fails
        no_desc = lec_client.post(f"/api/admin/courses/{course_id}/review/submit", data={}, content_type="application/json")
        self.assertEqual(no_desc.status_code, 400)
        self.assertEqual(no_desc.json()["code"], "DESCRIPTION_REQUIRED_FOR_REVIEW")

        # Add description & submit -> InReview
        from apps.courses.models import Course
        Course.objects.filter(pk=course_id).update(description="  وصف تفصيلي للدورة  ")
        sub_res = lec_client.post(f"/api/admin/courses/{course_id}/review/submit", data={}, content_type="application/json")
        self.assertEqual(sub_res.status_code, 201)

        # Admin approves -> PublishedCourseVersion v1 snapshotted
        dec_res = admin_client.post(
            f"/api/admin/courses/{course_id}/review/decide",
            data={"decision": "approve", "noteBody": "  ملاحظة مراجعة  "},
            content_type="application/json",
        )
        self.assertEqual(dec_res.status_code, 200)
        pub_id = dec_res.json()["data"]["publishedVersion"]["id"]
        self.assertEqual(PublishedCourseVersion.objects.get(pk=pub_id).version_number, 1)
        self.assertEqual(Module.objects.filter(published_version_id=pub_id).count(), 1)
        self.assertEqual(LessonItem.objects.filter(module__published_version_id=pub_id).count(), 1)
        self.assertEqual(QuizDefinition.objects.filter(lesson_item__module__published_version_id=pub_id).count(), 1)
        self.assertEqual(WorkingNote.objects.count(), 1)

        # Empty audience -> fail-closed (trainee1 sees 0 courses)
        t1_client = self._login(self.trainee1.phone_e164)
        self.assertEqual(len(t1_client.get("/api/courses").json()["data"]["courses"]), 0)

        # Target line1 -> trainee1 sees course, trainee2 does not
        CourseAudienceMetroLine.objects.create(course_id=course_id, metro_line=self.line1)
        self.assertEqual(len(t1_client.get("/api/courses").json()["data"]["courses"]), 1)
        t2_client = self._login(self.trainee2.phone_e164)
        self.assertEqual(len(t2_client.get("/api/courses").json()["data"]["courses"]), 0)

    def test_tr_c2_01_reminder_chain_blocked_and_d02_comment_anonymization(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        m_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة رئيسية", "courseType": "main", "description": "وصف"},
            content_type="application/json",
        )
        main_id = m_res.json()["data"]["course"]["id"]
        r_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة تذكيرية", "courseType": "reminder", "mainCourseId": main_id},
            content_type="application/json",
        )
        self.assertEqual(r_res.status_code, 201)
        rem_id = r_res.json()["data"]["course"]["id"]

        # Reminder-of-Reminder rejected (409)
        chain_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "سلسلة مرفوضة", "courseType": "reminder", "mainCourseId": rem_id},
            content_type="application/json",
        )
        self.assertEqual(chain_res.status_code, 409)
        self.assertEqual(chain_res.json()["code"], "REMINDER_CHAIN_PROHIBITED")

        # Draft course blocks trainee comment IDOR (403); once published, comment + D-02 anonymization succeed
        t1_client = self._login(self.trainee1.phone_e164)
        self.assertEqual(
            t1_client.post(
                f"/api/courses/{main_id}/comments",
                data={"body": "  تعليق مفيد  "},
                content_type="application/json",
            ).status_code,
            403,
        )
        from apps.courses.models import Course

        Course.objects.filter(pk=main_id).update(lifecycle_status="Published", access_mode="all_trainees")
        self.assertEqual(
            t1_client.post(
                f"/api/courses/{main_id}/comments",
                data={"body": "  تعليق مفيد  "},
                content_type="application/json",
            ).status_code,
            201,
        )
        anonymize_user_comments(self.trainee1)
        comments = t1_client.get(f"/api/courses/{main_id}/comments").json()["data"]["comments"]
        self.assertEqual(comments[0]["authorName"], "مستخدم محذوف")
        self.assertTrue(comments[0]["isAuthorDeleted"])
        self.assertEqual(comments[0]["body"], "  تعليق مفيد  ")

