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

    def test_approvals_queue_review_studio_staged_edits_notes_and_decisions(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        admin_client = self._login(self.admin.phone_e164)
        asst_client = self._login(self.assistant.phone_e164)
        t1_client = self._login(self.trainee1.phone_e164)

        # Create & save curriculum draft + submit for review
        c_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة الجودة والسلامة", "courseType": "main", "description": "وصف شامل للدورة"},
            content_type="application/json",
        )
        self.assertEqual(c_res.status_code, 201)
        course_id = int(c_res.json()["data"]["course"]["id"])

        draft_res = lec_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={
                "titleSnapshot": "دورة الجودة والسلامة",
                "modules": [
                    {
                        "title": "الفصل الأول",
                        "sortOrder": 1,
                        "lessons": [
                            {
                                "title": "درس السلامة",
                                "description": "شرح تفصيلي لخطوات السلامة في هذا الفيديو.",
                                "lessonType": "video",
                                "sortOrder": 1,
                                "durationSeconds": 1800,
                                "externalVideoUrl": "https://example.com/safety.mp4",
                            }
                        ],
                    }
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_res.status_code, 200)
        self.assertEqual(
            draft_res.json()["data"]["course"]["chapters"][0]["items"][0]["description"],
            "شرح تفصيلي لخطوات السلامة في هذا الفيديو.",
        )
        self.assertEqual(
            lec_client.post(f"/api/admin/courses/{course_id}/review/submit", data={}, content_type="application/json").status_code,
            201,
        )

        # Queue returns enriched fields with course id & stats
        q_res = admin_client.get("/api/approvals/queue")
        self.assertEqual(q_res.status_code, 200)
        q_items = q_res.json()["data"]["items"]
        self.assertEqual(len(q_items), 1)
        q_item = q_items[0]
        self.assertEqual(q_item["id"], str(course_id))
        self.assertEqual(q_item["courseId"], str(course_id))
        self.assertEqual(q_item["title"], "دورة الجودة والسلامة")
        self.assertEqual(q_item["lecturerName"], "محاضر")
        self.assertEqual(q_item["chapterCount"], 1)
        self.assertEqual(q_item["lessonCount"], 1)
        self.assertEqual(q_item["estimatedHours"], 0.5)
        self.assertFalse(q_item["hasStagedEdits"])

        # Trainee is blocked from review-data (403 IDOR check); assistant_admin can inspect queue/notes read-only
        self.assertEqual(t1_client.get(f"/api/courses/{course_id}/review-data").status_code, 403)
        self.assertEqual(asst_client.get(f"/api/courses/{course_id}/review-data").status_code, 200)
        self.assertEqual(asst_client.get(f"/api/admin/review/{course_id}/working-notes").status_code, 200)

        # Admin saves private working notes -> persists and hidden from lecturer
        notes_put = admin_client.put(
            f"/api/admin/review/{course_id}/working-notes",
            data={
                "generalNote": "  ملاحظة سرية للمراجع  ",
                "chapterNotes": {"1": "فحص الفصل"},
                "itemNotes": {},
            },
            content_type="application/json",
        )
        self.assertEqual(notes_put.status_code, 200)
        self.assertEqual(notes_put.json()["data"]["notes"]["generalNote"], "ملاحظة سرية للمراجع")
        notes_get = admin_client.get(f"/api/admin/review/{course_id}/working-notes")
        self.assertEqual(notes_get.json()["data"]["notes"]["chapterNotes"], {"1": "فحص الفصل"})

        # Admin stages edits with optimistic revision & conflict detection (409)
        se_save1 = admin_client.put(
            f"/api/admin/review/{course_id}/staged-edits",
            data={
                "baselineId": str(course_id),
                "clientRevision": 1,
                "patch": {"title": "دورة الجودة والسلامة - نسخة معدلة"},
            },
            content_type="application/json",
        )
        self.assertEqual(se_save1.status_code, 200)
        self.assertEqual(se_save1.json()["data"]["record"]["clientRevision"], 1)

        # Stale revision -> 409 conflict
        se_conflict = admin_client.put(
            f"/api/admin/review/{course_id}/staged-edits",
            data={"baselineId": str(course_id), "clientRevision": 1, "patch": {"title": "تعارض"}},
            content_type="application/json",
        )
        self.assertEqual(se_conflict.status_code, 409)

        # Queue now flags hasStagedEdits=True
        q_after = admin_client.get("/api/approvals/queue").json()["data"]["items"][0]
        self.assertTrue(q_after["hasStagedEdits"])

        # Lecturer review-data strips stagedEdits & workingNotes
        lec_rd = lec_client.get(f"/api/courses/{course_id}/review-data").json()["data"]
        self.assertIsNone(lec_rd["stagedEdits"])
        self.assertIsNone(lec_rd["workingNotes"])

        # Admin returns course with admin edits via /decision endpoint
        ret_res = admin_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={
                "outcome": "returned_with_admin_edits",
                "summaryMessage": "تم تعديل العنوان وإعادته للمراجعة النهائية.",
            },
            content_type="application/json",
        )
        self.assertEqual(ret_res.status_code, 200)
        self.assertEqual(ret_res.json()["data"]["outcome"], "returned_with_admin_edits")
        self.assertEqual(ret_res.json()["data"]["course"]["title"], "دورة الجودة والسلامة - نسخة معدلة")

        # Lecturer's my-submissions reflects needs_revision & official feedback
        my_subs = lec_client.get("/api/approvals/my-submissions").json()["data"]
        self.assertEqual(my_subs["counts"]["needsRevision"], 1)
        self.assertEqual(my_subs["items"][0]["id"], str(course_id))
        self.assertEqual(my_subs["items"][0]["reviewState"], "needs_revision")
        self.assertIsNotNone(my_subs["items"][0]["activeReviewFeedback"])

        # Lecturer resubmits and admin approves with staged edits
        self.assertEqual(
            lec_client.post(f"/api/admin/courses/{course_id}/review/submit", data={}, content_type="application/json").status_code,
            201,
        )
        se_save2 = admin_client.put(
            f"/api/admin/review/{course_id}/staged-edits",
            data={"baselineId": str(course_id), "clientRevision": 1, "patch": {"title": "دورة الجودة المعتمدة"}},
            content_type="application/json",
        )
        self.assertEqual(se_save2.status_code, 200)

        app_res = admin_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={
                "outcome": "approved",
                "approvalNote": "موافق بعد المراجعة",
                "publishOption": "with_staged_edits",
            },
            content_type="application/json",
        )
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.json()["data"]["outcome"], "approved")
        self.assertEqual(app_res.json()["data"]["course"]["title"], "دورة الجودة المعتمدة")
        self.assertEqual(app_res.json()["data"]["course"]["status"], "published")
        self.assertEqual(
            app_res.json()["data"]["course"]["chapters"][0]["items"][0]["description"],
            "شرح تفصيلي لخطوات السلامة في هذا الفيديو.",
        )
        # Review-data auditLog records submit, returned_with_admin_edits, resubmit, approved
        rd_final = admin_client.get(f"/api/courses/{course_id}/review-data").json()["data"]
        self.assertGreaterEqual(len(rd_final["auditLog"]), 4)
        self.assertEqual(rd_final["submissionType"], "update")

    def test_course_edit_hydration_preserves_media_external_videos_and_duration(self) -> None:
        from django.core.files.uploadedfile import SimpleUploadedFile

        lec_client = self._login(self.lecturer.phone_e164)
        c_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة المعاينة والتحرير", "courseType": "main", "description": "وصف"},
            content_type="application/json",
        )
        self.assertEqual(c_res.status_code, 201)
        course_id = int(c_res.json()["data"]["course"]["id"])

        pdf_file = SimpleUploadedFile("guide.pdf", b"%PDF-1.4\n%test\n%%EOF", content_type="application/pdf")
        up_res = lec_client.post("/api/media/assets/upload", data={"file": pdf_file, "courseId": str(course_id)})
        self.assertEqual(up_res.status_code, 201)
        asset_id = up_res.json()["data"]["asset"]["id"]

        draft_res = lec_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={
                "titleSnapshot": "دورة المعاينة والتحرير",
                "chapters": [
                    {
                        "title": "الفصل الأول",
                        "items": [
                            {
                                "title": "فيديو يوتيوب",
                                "type": "video",
                                "duration": "12:30",
                                "videoSourceType": "youtube",
                                "externalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            },
                            {
                                "title": "ملف دليل PDF",
                                "type": "pdf",
                                "mediaId": str(asset_id),
                                "url": f"/api/media/assets/{asset_id}/stream",
                            },
                        ],
                    }
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_res.status_code, 200)

        edit_res = lec_client.get(f"/api/lecturer/courses/{course_id}")
        self.assertEqual(edit_res.status_code, 200)
        items = edit_res.json()["data"]["course"]["chapters"][0]["items"]
        yt_item, pdf_item = items[0], items[1]

        self.assertEqual(yt_item["videoSourceType"], "youtube")
        self.assertEqual(yt_item["youtubeVideoId"], "dQw4w9WgXcQ")
        self.assertEqual(yt_item["externalUrl"], "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        self.assertEqual(yt_item["duration"], "12:30")
        self.assertEqual(yt_item["durationSeconds"], 750)

        self.assertEqual(pdf_item["mediaId"], str(asset_id))
        self.assertEqual(pdf_item["originalFileName"], "guide.pdf")
        self.assertTrue(pdf_item["url"].startswith("/api/media/references/"))

    def test_review_and_approvals_role_hierarchy_across_all_reviewer_levels(self) -> None:
        now = timezone.now()
        for rk in ("developer", "super_admin"):
            RolePolicy.objects.get_or_create(
                role_key=rk,
                defaults={
                    "default_capabilities_json": sorted(ROLE_DEFAULT_CAPABILITIES[rk]),
                    "updated_at": now,
                    "updated_by": "system",
                },
            )
        super_admin = User.objects.create_user(
            phone_e164="+201099887701",
            password="TestPassword@123",
            role_id="super_admin",
            full_name="مدير أعلى",
            national_id="29901010109901",
            date_of_birth=datetime.date(1990, 1, 1),
            metro_line=self.line1,
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="ماجستير",
            address="القاهرة",
        )
        developer = User.objects.create_user(
            phone_e164="+201099887702",
            password="TestPassword@123",
            role_id="developer",
            full_name="مطور المنظومة",
            national_id="29901010109902",
            date_of_birth=datetime.date(1990, 1, 1),
            metro_line=self.line1,
            marital_status=self.marital,
            appointment_date=datetime.date(2020, 1, 1),
            military_service_status=self.military,
            educational_qualification="هندسة",
            address="القاهرة",
        )

        lec_client = self._login(self.lecturer.phone_e164)
        c_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة فحص مستويات المراجعة", "courseType": "main", "description": "وصف تفصيلي للدورة"},
            content_type="application/json",
        )
        self.assertEqual(c_res.status_code, 201)
        course_id = int(c_res.json()["data"]["course"]["id"])
        sub_res = lec_client.post(
            f"/api/admin/courses/{course_id}/review/submit",
            data={},
            content_type="application/json",
        )
        self.assertEqual(sub_res.status_code, 201)

        # assistant_admin: can view queue, review-data, working-notes; blocked from staged-edits write & decide
        asst_client = self._login(self.assistant.phone_e164)
        self.assertEqual(asst_client.get("/api/approvals/queue").status_code, 200)
        self.assertEqual(asst_client.get(f"/api/courses/{course_id}/review-data").status_code, 200)
        self.assertEqual(asst_client.get(f"/api/admin/review/{course_id}/working-notes").status_code, 200)
        self.assertEqual(
            asst_client.put(
                f"/api/admin/review/{course_id}/staged-edits",
                data={"baselineId": str(course_id), "clientRevision": 0, "patch": {"title": "محاولة مساعد"}},
                content_type="application/json",
            ).status_code,
            403,
        )
        self.assertEqual(
            asst_client.post(
                f"/api/admin/review/{course_id}/decision",
                data={"outcome": "approved", "publishOption": "as_submitted"},
                content_type="application/json",
            ).status_code,
            403,
        )

        # super_admin & developer: full access to queue, review-data, staged edits, and decision
        sa_client = self._login(super_admin.phone_e164)
        self.assertEqual(sa_client.get("/api/approvals/queue").status_code, 200)
        self.assertEqual(sa_client.get(f"/api/courses/{course_id}/review-data").status_code, 200)
        ret_res = sa_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={"outcome": "rejected", "summaryMessage": "يرجى التعديل"},
            content_type="application/json",
        )
        self.assertEqual(ret_res.status_code, 200)
        self.assertEqual(ret_res.json()["data"]["outcome"], "rejected")
        self.assertEqual(ret_res.json()["data"]["auditEntry"]["actorRole"], "admin")

        # Re-submit and let developer approve
        self.assertEqual(
            lec_client.post(
                f"/api/admin/courses/{course_id}/review/submit",
                data={},
                content_type="application/json",
            ).status_code,
            201,
        )
        dev_client = self._login(developer.phone_e164)
        self.assertEqual(dev_client.get("/api/approvals/queue").status_code, 200)
        app_res = dev_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={"outcome": "approved", "publishOption": "as_submitted"},
            content_type="application/json",
        )
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.json()["data"]["outcome"], "approved")
        self.assertEqual(app_res.json()["data"]["course"]["status"], "published")
        self.assertEqual(app_res.json()["data"]["auditEntry"]["actorRole"], "admin")

    def test_course_cover_theme_persists_across_draft_and_publish(self) -> None:
        lec_client = self._login(self.lecturer.phone_e164)
        admin_client = self._login(self.admin.phone_e164)
        trainee_client = self._login(self.trainee1.phone_e164)

        create_res = lec_client.post(
            "/api/lecturer/courses",
            data={
                "title": "دورة ألوان الغلاف",
                "courseType": "main",
                "description": "وصف الدورة لاختبار ثبات لون الغلاف عند النشر.",
            },
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        course_id = int(create_res.json()["data"]["course"]["id"])

        draft_res = lec_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={
                "titleSnapshot": "دورة ألوان الغلاف",
                "description": "وصف الدورة لاختبار ثبات لون الغلاف عند النشر.",
                "coverType": "color",
                "coverColor": "#065F46",
                "accessMode": "all_trainees",
                "chapters": [{"title": "الفصل الأول", "items": []}],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_res.status_code, 200)
        self.assertEqual(draft_res.json()["data"]["course"]["coverType"], "color")
        self.assertEqual(draft_res.json()["data"]["course"]["coverColor"], "#065F46")

        sub_res = lec_client.post(
            f"/api/admin/courses/{course_id}/review/submit",
            data={},
            content_type="application/json",
        )
        self.assertEqual(sub_res.status_code, 201)

        dec_res = admin_client.post(
            f"/api/admin/courses/{course_id}/review/decide",
            data={"decision": "approve"},
            content_type="application/json",
        )
        self.assertEqual(dec_res.status_code, 200)

        pub = PublishedCourseVersion.objects.filter(course_id=course_id).order_by("-version_number").first()
        self.assertIsNotNone(pub)
        self.assertEqual(pub.cover_type, "color")
        self.assertEqual(pub.cover_color, "#065F46")

        detail_res = trainee_client.get(f"/api/courses/{course_id}")
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json()["data"]["course"]["coverType"], "color")
        self.assertEqual(detail_res.json()["data"]["course"]["coverColor"], "#065F46")

        list_res = trainee_client.get("/api/courses")
        self.assertEqual(list_res.status_code, 200)
        listed = [c for c in list_res.json()["data"]["courses"] if int(c["id"]) == course_id]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["coverType"], "color")
        self.assertEqual(listed[0]["coverColor"], "#065F46")

    def test_pending_review_notifications_resolve_and_review_endpoints_lock_after_decision(self) -> None:
        from apps.communications.models import NotificationItem

        lec_client = self._login(self.lecturer.phone_e164)
        admin_client = self._login(self.admin.phone_e164)
        assistant_client = self._login(self.assistant.phone_e164)

        create_res = lec_client.post(
            "/api/lecturer/courses",
            data={"title": "دورة إغلاق إشعار المراجعة", "courseType": "main", "description": "وصف"},
            content_type="application/json",
        )
        self.assertEqual(create_res.status_code, 201)
        course_id = int(create_res.json()["data"]["course"]["id"])

        draft_res = lec_client.put(
            f"/api/lecturer/courses/{course_id}/draft",
            data={
                "titleSnapshot": "دورة إغلاق إشعار المراجعة",
                "chapters": [
                    {
                        "title": "الوحدة الأولى",
                        "items": [
                            {
                                "title": "درس تمهيدي",
                                "type": "video",
                                "duration": "01:00",
                                "videoSourceType": "youtube",
                                "externalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                            }
                        ],
                    }
                ],
            },
            content_type="application/json",
        )
        self.assertEqual(draft_res.status_code, 200)

        sub_res = lec_client.post(
            f"/api/admin/courses/{course_id}/review/submit",
            data={},
            content_type="application/json",
        )
        self.assertEqual(sub_res.status_code, 201)

        # Before decision: review-data hasPendingSubmission=True and admin/assistant received open review notification
        rd_before = admin_client.get(f"/api/courses/{course_id}/review-data").json()["data"]
        self.assertTrue(rd_before["hasPendingSubmission"])
        self.assertEqual(rd_before["reviewStatus"], "Pending")

        admin_notifs_before = admin_client.get("/api/notifications").json()["data"]["notifications"]
        pending_notif = next(
            n for n in admin_notifs_before
            if n["type"] == "content_pending_review" and str(n.get("courseId")) == str(course_id)
        )
        self.assertTrue(pending_notif["actionRequired"])
        self.assertEqual(pending_notif["targetUrl"], f"/admin/review/{course_id}")

        # Approve via Review Studio decision endpoint
        dec_res = admin_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={"outcome": "approved", "approvalNote": "معتمد"},
            content_type="application/json",
        )
        self.assertEqual(dec_res.status_code, 200)

        # Existing pending review notification is now resolved for every reviewer
        for client_session in (admin_client, assistant_client):
            notifs_after = client_session.get("/api/notifications").json()["data"]["notifications"]
            resolved_notif = next(
                n for n in notifs_after
                if n["type"] == "content_pending_review" and str(n.get("courseId")) == str(course_id)
            )
            self.assertFalse(resolved_notif["actionRequired"])
            self.assertIsNone(resolved_notif["targetUrl"])
            self.assertTrue(resolved_notif["metadata"]["reviewResolved"])

        # Direct review-data shows hasPendingSubmission=False & mutating endpoints return 409 ALREADY_DECIDED
        rd_after = admin_client.get(f"/api/courses/{course_id}/review-data").json()["data"]
        self.assertFalse(rd_after["hasPendingSubmission"])
        self.assertEqual(rd_after["reviewStatus"], "Approved")

        staged_after = admin_client.put(
            f"/api/admin/review/{course_id}/staged-edits",
            data={"patchedContent": {"title": "تعديل متأخر"}, "clientRevision": 1},
            content_type="application/json",
        )
        self.assertEqual(staged_after.status_code, 409)

        repeat_dec = admin_client.post(
            f"/api/admin/review/{course_id}/decision",
            data={"outcome": "approved"},
            content_type="application/json",
        )
        self.assertEqual(repeat_dec.status_code, 409)

        # Even a stale pre-existing notification row is auto-resolved when listing /api/notifications
        NotificationItem.objects.create(
            user=self.admin,
            title="إشعار قديم",
            body="إشعار قبل التحديث",
            notif_type="content_pending_review",
            target_url=f"/admin/review/{course_id}",
            action_required=True,
            metadata_json={"courseId": str(course_id)},
            is_read=False,
            created_at=timezone.now(),
        )
        stale_list = admin_client.get("/api/notifications").json()["data"]["notifications"]
        stale_fixed = next(n for n in stale_list if n["title"] == "إشعار قديم")
        self.assertFalse(stale_fixed["actionRequired"])
        self.assertIsNone(stale_fixed["targetUrl"])
        self.assertTrue(stale_fixed["metadata"]["reviewResolved"])



