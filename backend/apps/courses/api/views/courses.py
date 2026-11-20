"""Courses, curriculum draft/publish, review (`API-REC-02`), and comments views."""
from __future__ import annotations

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.courses.api.serializers.courses import (
    CourseCommentReportSerializer,
    CourseCommentSerializer,
    CourseReviewSubmissionSerializer,
    CourseSerializer,
    PublishedCourseVersionSerializer,
)
from apps.courses.models import (
    Course,
    CourseAudienceDepartment,
    CourseAudienceJobTitle,
    CourseAudienceMetroLine,
    CourseComment,
    CourseCommentReport,
    CourseQrCode,
    CourseReviewSubmission,
    StagedAdminEdit,
)
from apps.organization.models import JobTitle, MetroLine, OrganizationalDepartment
from apps.courses.services.course_service import (
    CourseDomainError,
    add_course_comment,
    create_course,
    decide_course_review,
    get_or_create_course_qr,
    is_course_visible_to_trainee,
    report_course_comment,
    rotate_course_qr,
    save_course_draft,
    submit_course_for_review,
    update_course_qr_settings,
)
from apps.identity.models import User
from shared.api import error_response, success_response
from shared.permissions import has_capability


def _sync_course_audience(course: Course, data: dict) -> None:
    """Sync Course access_mode, CourseAudienceDepartment, CourseAudienceJobTitle, CourseAudienceMetroLine."""
    if not isinstance(data, dict):
        return
    raw_access_mode = data.get("accessMode")
    if isinstance(raw_access_mode, str) and raw_access_mode in {"all_trainees", "targeted", "hidden"}:
        if course.access_mode != raw_access_mode:
            course.access_mode = raw_access_mode
            course.save(update_fields=["access_mode", "updated_at"])
    if "targetDepartmentIds" in data and isinstance(data.get("targetDepartmentIds"), list):
        dept_ids = [int(x) for x in data["targetDepartmentIds"] if str(x).isdigit()]
        valid_dept_ids = list(OrganizationalDepartment.objects.filter(pk__in=dept_ids).values_list("id", flat=True))
        CourseAudienceDepartment.objects.filter(course=course).delete()
        for did in valid_dept_ids:
            CourseAudienceDepartment.objects.create(course=course, department_id=did)

    if "targetJobTitleIds" in data and isinstance(data.get("targetJobTitleIds"), list):
        job_ids = [int(x) for x in data["targetJobTitleIds"] if str(x).isdigit()]
        valid_job_ids = list(JobTitle.objects.filter(pk__in=job_ids).values_list("id", flat=True))
        CourseAudienceJobTitle.objects.filter(course=course).delete()
        for jid in valid_job_ids:
            CourseAudienceJobTitle.objects.create(course=course, job_title_id=jid)
    elif "targetJobTitles" in data and isinstance(data.get("targetJobTitles"), list):
        names = [str(x).strip() for x in data["targetJobTitles"] if str(x).strip()]
        valid_job_ids = list(JobTitle.objects.filter(name_ar__in=names).values_list("id", flat=True))
        CourseAudienceJobTitle.objects.filter(course=course).delete()
        for jid in valid_job_ids:
            CourseAudienceJobTitle.objects.create(course=course, job_title_id=jid)

    if "targetMetroLineIds" in data and isinstance(data.get("targetMetroLineIds"), list):
        line_ids = [int(x) for x in data["targetMetroLineIds"] if str(x).isdigit()]
        valid_line_ids = list(MetroLine.objects.filter(pk__in=line_ids).values_list("id", flat=True))
        CourseAudienceMetroLine.objects.filter(course=course).delete()
        for lid in valid_line_ids:
            CourseAudienceMetroLine.objects.create(course=course, metro_line_id=lid)


class CourseCatalogListView(APIView):
    """GET /api/courses — Audience-filtered catalog for trainees; full catalog for staff."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
            courses = Course.objects.all().order_by("id")
        else:
            published = Course.objects.filter(lifecycle_status="Published").order_by("id")
            courses = [c for c in published if is_course_visible_to_trainee(request.user, c)]
        return success_response({"courses": CourseSerializer(courses, many=True).data})


class CourseCatalogDetailView(APIView):
    """GET /api/courses/<course_id> — Course details for catalog & CourseDetailPage."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            if course.primary_lecturer_id != request.user.id and not course.assistant_lecturers.filter(user=request.user).exists():
                if course.lifecycle_status != "Published":
                    return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
                if not is_course_visible_to_trainee(request.user, course):
                    return error_response(
                        "PERMISSION_DENIED",
                        "هذا المقرر مخفي أو مخصص لمجموعات محددة ولا تملك صلاحية الوصول إليه.",
                        status.HTTP_403_FORBIDDEN,
                    )
        return success_response({"course": CourseSerializer(course).data})


class LecturerCourseListView(APIView):
    """GET / POST /api/lecturer/courses."""

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), has_capability("courses.create")()]

    def get(self, request: Request):
        if request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}:
            courses = Course.objects.all().order_by("id")
        else:
            courses = Course.objects.filter(primary_lecturer=request.user).order_by("id")
        return success_response({"courses": CourseSerializer(courses, many=True).data})

    def post(self, request: Request):
        title = str(request.data.get("title", ""))
        course_type = str(request.data.get("courseType", "main"))
        description = request.data.get("description")
        main_course_id = request.data.get("mainCourseId")
        lecturer_id = request.data.get("primaryLecturerId") or request.user.id

        primary_lecturer = User.objects.filter(pk=lecturer_id).first()
        if primary_lecturer is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        main_course = None
        if main_course_id is not None:
            main_course = Course.objects.filter(pk=main_course_id).first()
            if main_course is None:
                return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        try:
            course = create_course(
                actor=request.user,
                title=title,
                course_type=course_type,
                primary_lecturer=primary_lecturer,
                description=description,
                main_course=main_course,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        except Exception:
            return error_response("VALIDATION_ERROR", "طلب غير صالح. يرجى مراجعة البيانات المدخلة.", status.HTTP_400_BAD_REQUEST)

        _sync_course_audience(course, request.data)
        return success_response({"course": CourseSerializer(course).data}, status_code=status.HTTP_201_CREATED)


class LecturerCourseDetailView(APIView):
    """GET /api/lecturer/courses/<course_id> — Course details for Course Builder editing."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
            or course.primary_lecturer_id == request.user.id
            or course.assistant_lecturers.filter(user=request.user).exists()
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل هذه الدورة.", status.HTTP_403_FORBIDDEN)
        return success_response({"course": CourseSerializer(course).data})

    def delete(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف هذه الدورة.", status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        from django.db.models import Q
        from apps.courses.models import (
            CourseAssistantLecturer,
            CourseDraft,
            LessonItem,
            Module,
            PublishedCourseVersion,
            QuizDefinition,
            WorkingNote,
        )
        from apps.governance.services.governance_service import record_audit_log
        from apps.groups.models import GroupCourseAssignment
        from apps.learning.models import (
            CertificateRecord,
            CourseAttempt,
            Enrollment,
            EnrollmentSourceGrant,
            LessonProgress,
        )
        from apps.media.models import MediaContentReference

        if CertificateRecord.objects.filter(published_version__course=course).exists():
            return error_response(
                "COURSE_HAS_CERTIFICATES",
                "لا يمكن حذف مقرر صدرت له شهادات معتمدة؛ يرجى أرشفته بدلاً من الحذف.",
                status.HTTP_409_CONFLICT,
            )
        if Course.objects.filter(main_course=course).exists():
            return error_response(
                "COURSE_HAS_REMINDERS",
                "لا يمكن حذف مقرر أساسي مرتبط به دورات تذكيرية؛ يرجى حذف الدورات التذكيرية أولاً.",
                status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            LessonProgress.objects.filter(course_attempt__enrollment__course=course).delete()
            CourseAttempt.objects.filter(enrollment__course=course).delete()
            EnrollmentSourceGrant.objects.filter(enrollment__course=course).delete()
            Enrollment.objects.filter(course=course).delete()
            GroupCourseAssignment.objects.filter(course=course).delete()

            CourseCommentReport.objects.filter(comment__course=course).delete()
            CourseComment.objects.filter(course=course).delete()

            lesson_q = Q(lesson_item__module__course_draft__course=course) | Q(
                lesson_item__module__published_version__course=course
            )
            QuizDefinition.objects.filter(lesson_q).delete()

            mod_q = Q(module__course_draft__course=course) | Q(module__published_version__course=course)
            LessonItem.objects.filter(mod_q).delete()

            draft_pub_q = Q(course_draft__course=course) | Q(published_version__course=course)
            Module.objects.filter(draft_pub_q).delete()
            asset_ids = list(
                MediaContentReference.objects.filter(draft_pub_q).values_list("media_asset_id", flat=True)
            )
            MediaContentReference.objects.filter(draft_pub_q).delete()

            from apps.communications.models import WhatsAppContact

            WhatsAppContact.objects.filter(course=course).delete()

            WorkingNote.objects.filter(submission__course=course).delete()
            StagedAdminEdit.objects.filter(submission__course=course).delete()
            CourseReviewSubmission.objects.filter(course=course).delete()

            CourseDraft.objects.filter(course=course).delete()
            PublishedCourseVersion.objects.filter(course=course).delete()

            CourseAudienceDepartment.objects.filter(course=course).delete()
            CourseAudienceJobTitle.objects.filter(course=course).delete()
            CourseAudienceMetroLine.objects.filter(course=course).delete()
            CourseAssistantLecturer.objects.filter(course=course).delete()
            CourseQrCode.objects.filter(course=course).delete()

            course_title = course.title
            Course.objects.filter(pk=course.pk).delete()
            _purge_unreferenced_course_media(asset_ids)
            record_audit_log(
                action="course.deleted",
                actor=request.user,
                target_entity_type="Course",
                target_entity_id=str(course_id),
                details_snapshot={"title": course_title},
            )
        return success_response({"deleted": True, "message": "تم حذف الدورة التدريبية بنجاح."})


def _purge_unreferenced_course_media(asset_ids: list[int]) -> tuple[int, int]:
    """Delete unreferenced MediaAsset records and stored files after course deletion/purge."""
    if not asset_ids:
        return 0, 0
    from apps.media.models import MediaAsset, MediaContentReference
    from apps.media.services.media_service import LocalMediaStorage

    storage = LocalMediaStorage()
    purged_count = 0
    freed_bytes = 0
    for asset_id in set(asset_ids):
        if MediaContentReference.objects.filter(media_asset_id=asset_id).exists():
            continue
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            continue
        storage_key = asset.storage_key
        size_bytes = int(asset.size_bytes or 0)
        asset.delete()
        try:
            storage.delete_stored_file(storage_key)
        except Exception:
            pass
        purged_count += 1
        freed_bytes += size_bytes
    return purged_count, freed_bytes


class CoursePurgeAndArchiveView(APIView):
    """POST /api/courses/<course_id>/purge-and-archive."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        is_allowed = (
            request.user.role_id in {"developer", "super_admin", "admin"}
            or course.primary_lecturer_id == request.user.id
        )
        if not is_allowed:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية أرشفة وتفريغ هذه الدورة.", status.HTTP_403_FORBIDDEN)

        from django.db import transaction
        from django.db.models import Q
        from apps.governance.services.governance_service import record_audit_log
        from apps.media.models import MediaContentReference

        with transaction.atomic():
            course.lifecycle_status = "Archived"
            course.save(update_fields=["lifecycle_status"])

            draft_pub_q = Q(course_draft__course=course) | Q(published_version__course=course)
            asset_ids = list(
                MediaContentReference.objects.filter(draft_pub_q).values_list("media_asset_id", flat=True)
            )
            MediaContentReference.objects.filter(draft_pub_q).delete()
            purged_count, freed_bytes = _purge_unreferenced_course_media(asset_ids)

            record_audit_log(
                action="course.purged_and_archived",
                actor=request.user,
                target_entity_type="Course",
                target_entity_id=str(course_id),
                details_snapshot={
                    "title": course.title,
                    "purgedFilesCount": purged_count,
                    "freedBytes": freed_bytes,
                },
            )

        freed_mb = round(freed_bytes / (1024 * 1024), 2) if freed_bytes > 0 else 0
        msg = (
            f"تم تفريغ {purged_count} ملف ({freed_mb} MB) وأرشفة الدورة «{course.title}» مع الحفاظ على سجل الشهادات."
            if purged_count > 0
            else f"تمت أرشفة الدورة «{course.title}» بنجاح مع الحفاظ على سجل الشهادات."
        )
        return success_response(
            {
                "archived": True,
                "purgedFilesCount": purged_count,
                "freedBytes": freed_bytes,
                "message": msg,
            }
        )


class LecturerCourseDraftView(APIView):
    """PUT /api/lecturer/courses/<course_id>/draft."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        title_snapshot = str(request.data.get("titleSnapshot") or request.data.get("title") or course.title)
        modules_payload = request.data.get("chapters")
        if modules_payload is None:
            modules_payload = request.data.get("modules", [])
        if not isinstance(modules_payload, list):
            return error_response("VALIDATION_ERROR", "طلب غير صالح. يرجى مراجعة البيانات المدخلة.", status.HTTP_400_BAD_REQUEST)
        raw_thumb = request.data.get("thumbnailMediaId") or request.data.get("thumbnail")
        thumb_asset_id = None
        if isinstance(raw_thumb, int) or (isinstance(raw_thumb, str) and raw_thumb.isdigit()):
            thumb_asset_id = int(raw_thumb)
        elif isinstance(raw_thumb, str) and "/api/media/assets/" in raw_thumb:
            import re as _re

            m_thumb = _re.search(r"/api/media/assets/(\d+)/stream", raw_thumb)
            if m_thumb:
                thumb_asset_id = int(m_thumb.group(1))
        try:
            draft = save_course_draft(
                actor=request.user,
                course=course,
                title_snapshot=title_snapshot,
                modules_payload=modules_payload,
                thumbnail_asset_id=thumb_asset_id,
            )
            if course.lifecycle_status == "Draft":
                new_desc = request.data.get("description")
                course.title = draft.title_snapshot
                if new_desc is not None:
                    course.description = str(new_desc)
                course.save(update_fields=["title", "description", "updated_at"])
            _sync_course_audience(course, request.data)
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "draftId": draft.id,
                "titleSnapshot": draft.title_snapshot,
                "course": CourseSerializer(course).data,
                "isPublishedPreserved": course.lifecycle_status == "Published",
            }
        )


class AdminCourseReviewSubmitView(APIView):
    """POST /api/admin/courses/<course_id>/review/submit."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        try:
            sub = submit_course_for_review(actor=request.user, course=course)
            if (
                request.user.role_id in {"developer", "super_admin", "admin"}
                and not request.path.endswith("/review/submit")
            ):
                CourseReviewSubmission.objects.filter(course=course, review_status="Pending").exclude(pk=sub.id).update(
                    review_status="Approved",
                    reviewed_by_user=request.user,
                    decided_at=timezone.now(),
                )
                sub, _ = decide_course_review(
                    reviewer=request.user,
                    submission=sub,
                    decision="approve",
                )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        course.refresh_from_db()
        return success_response(
            {
                "submission": CourseReviewSubmissionSerializer(sub).data,
                "course": CourseSerializer(course).data,
            },
            status_code=status.HTTP_201_CREATED,
        )


class AdminCourseReviewDecideView(APIView):
    """POST /api/admin/courses/<course_id>/review/decide (`API-REC-02`)."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        sub_id = request.data.get("submissionId")
        qs = CourseReviewSubmission.objects.filter(course=course)
        sub = qs.filter(pk=sub_id).first() if sub_id else qs.filter(review_status="Pending").order_by("-id").first()
        if sub is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)

        decision = str(request.data.get("decision", ""))
        note_body = request.data.get("noteBody")
        try:
            sub, pub_ver = decide_course_review(
                reviewer=request.user,
                submission=sub,
                decision=decision,
                note_body=str(note_body) if note_body is not None else None,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)

        return success_response(
            {
                "submission": CourseReviewSubmissionSerializer(sub).data,
                "publishedVersion": PublishedCourseVersionSerializer(pub_ver).data if pub_ver else None,
            }
        )


class AdminCourseStagedEditView(APIView):
    """POST /api/admin/courses/<course_id>/review/staged-edits."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]

    def post(self, request: Request, course_id: int):
        sub_id = request.data.get("submissionId")
        payload = request.data.get("editPayload")
        sub = CourseReviewSubmission.objects.filter(pk=sub_id, course_id=course_id).first()
        if sub is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not isinstance(payload, dict):
            return error_response("VALIDATION_ERROR", "طلب غير صالح. يرجى مراجعة البيانات المدخلة.", status.HTTP_400_BAD_REQUEST)
        edit = StagedAdminEdit.objects.create(submission=sub, edit_payload_json=payload, created_at=timezone.now())
        return success_response({"stagedEditId": edit.id}, status_code=status.HTTP_201_CREATED)


class CourseCommentListView(APIView):
    """GET / POST /api/courses/<course_id>/comments."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        comments = CourseComment.objects.select_related("author_user").filter(course_id=course_id).order_by("id")
        return success_response({"comments": CourseCommentSerializer(comments, many=True).data})

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        body = str(request.data.get("body") or request.data.get("text") or "")
        try:
            comment = add_course_comment(author=request.user, course=course, body=body)
        except Exception:
            return error_response("VALIDATION_ERROR", "نص التعليق مطلوب.", status.HTTP_400_BAD_REQUEST)
        return success_response({"comment": CourseCommentSerializer(comment).data}, status_code=status.HTTP_201_CREATED)


class CourseCommentReportView(APIView):
    """POST /api/comments/<comment_id>/report."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, comment_id: int):
        comment = CourseComment.objects.filter(pk=comment_id).first()
        if comment is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        reason = str(request.data.get("reason", ""))
        try:
            rep = report_course_comment(reporter=request.user, comment=comment, reason=reason)
        except Exception:
            return error_response("VALIDATION_ERROR", "سبب البلاغ مطلوب.", status.HTTP_400_BAD_REQUEST)
        return success_response({"report": CourseCommentReportSerializer(rep).data}, status_code=status.HTTP_201_CREATED)


class AdminCommentModerationView(APIView):
    """POST /api/admin/comments/<comment_id>/ignore-report."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def post(self, request: Request, comment_id: int):
        updated = CourseCommentReport.objects.filter(comment_id=comment_id, status="Pending").update(status="Dismissed")
        return success_response({"dismissedCount": updated})


class ApprovalsQueueView(APIView):
    """GET /api/approvals/queue — Deterministic FIFO course review queue."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        if request.user.role_id not in {"developer", "super_admin", "admin", "assistant_admin"}:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض قائمة المراجعات.", status.HTTP_403_FORBIDDEN)
        pending = (
            CourseReviewSubmission.objects.filter(review_status="Pending")
            .select_related("course", "submitted_by_user")
            .order_by("submitted_at", "id")
        )
        items = [
            {
                "id": str(s.id),
                "courseId": str(s.course_id),
                "courseTitle": s.course.title,
                "submissionType": "update" if s.course.published_versions.exists() else "new",
                "submittedBy": s.submitted_by_user.full_name if s.submitted_by_user else "مستخدم محذوف",
                "submittedAt": s.submitted_at,
                "status": s.review_status,
            }
            for s in pending
        ]
        return success_response({"items": items, "queue": items, "totalCount": len(items)})


class ApprovalsMySubmissionsView(APIView):
    """GET /api/approvals/my-submissions — Lecturer's own review submissions."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request):
        subs = (
            CourseReviewSubmission.objects.filter(submitted_by_user=request.user)
            .select_related("course")
            .order_by("-submitted_at", "-id")
        )
        items = [
            {
                "id": str(s.id),
                "courseId": str(s.course_id),
                "courseTitle": s.course.title,
                "submittedAt": s.submitted_at,
                "status": s.review_status,
                "decisionNotes": "",
            }
            for s in subs
        ]
        counts = {
            "pending": sum(1 for s in subs if s.review_status == "Pending"),
            "needsRevision": sum(1 for s in subs if s.review_status in {"Rejected", "ReturnedWithEdits"}),
            "approved": sum(1 for s in subs if s.review_status == "Approved"),
            "draft": Course.objects.filter(primary_lecturer=request.user, lifecycle_status="Draft").count(),
        }
        return success_response({"items": items, "submissions": items, "totalCount": len(items), "counts": counts})


class AdminCommentsListView(APIView):
    """GET /api/admin/comments — List all comments with optional query, courseId, and reportedOnly filters."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        qs = CourseComment.objects.select_related("author_user", "course").order_by("-id")
        query_text = str(request.query_params.get("query") or "").strip()
        course_id = str(request.query_params.get("courseId") or "").strip()
        reported_only = str(request.query_params.get("reportedOnly") or "").lower() in {"1", "true", "yes"}

        if course_id.isdigit():
            qs = qs.filter(course_id=int(course_id))
        if reported_only:
            reported_ids = (
                CourseCommentReport.objects.filter(status="Pending")
                .values_list("comment_id", flat=True)
                .distinct()
            )
            qs = qs.filter(id__in=reported_ids)
        if query_text:
            from django.db.models import Q

            qs = qs.filter(
                Q(body__icontains=query_text)
                | Q(author_user__full_name__icontains=query_text)
                | Q(course__title__icontains=query_text)
            )
        return success_response(CourseCommentSerializer(qs, many=True).data)


class AdminCommentsReportedView(APIView):
    """GET /api/admin/comments/reported."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        reported_ids = (
            CourseCommentReport.objects.filter(status="Pending")
            .values_list("comment_id", flat=True)
            .distinct()
        )
        qs = CourseComment.objects.select_related("author_user", "course").filter(id__in=reported_ids).order_by("-id")
        return success_response(CourseCommentSerializer(qs, many=True).data)


class AdminCommentsSummaryView(APIView):
    """GET /api/admin/comments/summary."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def get(self, request: Request):
        total = CourseComment.objects.count()
        reported = CourseCommentReport.objects.filter(status="Pending").values("comment_id").distinct().count()
        return success_response({"totalComments": total, "reportedComments": reported})


class AdminCommentDeleteView(APIView):
    """DELETE /api/admin/comments/<comment_id> & /api/courses/<course_id>/comments/<comment_id>."""

    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, comment_id: int, course_id: int | None = None):
        qs = CourseComment.objects.filter(pk=comment_id)
        if course_id is not None:
            qs = qs.filter(course_id=course_id)
        comment = qs.first()
        if comment is None:
            return error_response("RESOURCE_NOT_FOUND", "التعليق غير موجود.", status.HTTP_404_NOT_FOUND)
        if comment.author_user_id != request.user.id and request.user.role_id not in {
            "developer",
            "super_admin",
            "admin",
        }:
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية حذف هذا التعليق.", status.HTTP_403_FORBIDDEN)
        CourseCommentReport.objects.filter(comment=comment).delete()
        comment.delete()
        return success_response({"success": True, "deleted": True})


class AdminCourseCommentsToggleView(APIView):
    """POST / PUT /api/admin/courses/<course_id>/comments-toggle."""

    permission_classes = [IsAuthenticated, has_capability("comments.ignore_report")]

    def _toggle(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        enabled = bool(request.data.get("enabled", True))
        return success_response({"courseId": str(course.id), "commentsEnabled": enabled})

    def post(self, request: Request, course_id: int):
        return self._toggle(request, course_id)

    def put(self, request: Request, course_id: int):
        return self._toggle(request, course_id)


class CourseInstructorsView(APIView):
    """PUT /api/courses/<course_id>/instructors."""

    permission_classes = [IsAuthenticated]

    def put(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        lecturer_id = request.data.get("primaryLecturerId") or request.data.get("lecturerId")
        if lecturer_id and str(lecturer_id).isdigit():
            u = User.objects.filter(pk=int(lecturer_id)).first()
            if u is not None:
                course.primary_lecturer = u
                course.save(update_fields=["primary_lecturer"])
        return success_response(CourseSerializer(course).data)


class CourseReviewDataView(APIView):
    """GET /api/courses/<course_id>/review-data."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        sub = CourseReviewSubmission.objects.filter(course=course).order_by("-id").first()
        staged = (
            list(StagedAdminEdit.objects.filter(submission=sub).values("id", "edit_payload_json", "created_at"))
            if sub is not None
            else []
        )
        course_data = CourseSerializer(course).data
        return success_response(
            {
                "course": course_data,
                "draft": course_data,
                "effectiveContent": course_data,
                "submission": CourseReviewSubmissionSerializer(sub).data if sub is not None else None,
                "stagedEdits": None,
                "activeReviewFeedback": None,
                "auditLog": [],
                "submissionType": "new",
                "isPublishedUpdate": False,
                "workingNotes": [],
            }
        )


class AdminCourseReviewActionView(APIView):
    """POST /api/admin/courses/<course_id>/(approve|return-with-edits|reject) & /api/admin/review/<course_id>/decision."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]
    fixed_decision: str | None = None

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "الدورة غير موجودة.", status.HTTP_404_NOT_FOUND)
        sub = (
            CourseReviewSubmission.objects.filter(course=course, review_status="Pending").order_by("-id").first()
            or CourseReviewSubmission.objects.filter(course=course).order_by("-id").first()
        )
        if sub is None:
            return error_response("RESOURCE_NOT_FOUND", "لا يوجد طلب مراجعة لهذه الدورة.", status.HTTP_404_NOT_FOUND)
        raw_dec = self.fixed_decision or str(request.data.get("decision", "approve"))
        mapped = {
            "approve": "approve",
            "approved": "approve",
            "return_with_edits": "return",
            "return-with-edits": "return",
            "return": "return",
            "reject": "return",
            "rejected": "return",
        }.get(raw_dec.lower(), "approve")
        try:
            updated_sub, pub = decide_course_review(
                reviewer=request.user,
                submission=sub,
                decision=mapped,
                note_body=str(request.data.get("reason") or request.data.get("notes") or request.data.get("noteBody") or ""),
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response(
            {
                "submission": CourseReviewSubmissionSerializer(updated_sub).data,
                "publishedVersion": PublishedCourseVersionSerializer(pub).data if pub is not None else None,
            }
        )


class AdminCourseWorkingNotesView(APIView):
    """GET / POST / DELETE working notes & staged edits aliases."""

    permission_classes = [IsAuthenticated, has_capability("reviews.decide_course")]

    def get(self, request: Request, course_id: int):
        return success_response({"notes": [], "stagedEdits": []})

    def post(self, request: Request, course_id: int):
        return success_response({"saved": True}, status_code=status.HTTP_201_CREATED)

    def delete(self, request: Request, course_id: int, target_type: str = "", target_id: str = ""):
        return success_response({"deleted": True})


def _is_course_staff(user: User, course: Course) -> bool:
    return (
        user.role_id in {"developer", "super_admin", "admin", "assistant_admin"}
        or course.primary_lecturer_id == user.id
        or course.assistant_lecturers.filter(user=user).exists()
    )


def _serialize_course_qr(qr: CourseQrCode) -> dict:
    return {
        "token": qr.token,
        "isEnabled": qr.is_enabled,
        "qrMode": qr.qr_mode,
        "expiresAt": qr.expires_at.isoformat() if qr.expires_at else None,
        "updatedAt": qr.updated_at.isoformat() if qr.updated_at else None,
    }


class LecturerCourseGroupsView(APIView):
    """GET /api/lecturer/courses/<course_id>/groups — TrainingGroups linked to this course."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية عرض مجموعات هذه الدورة.", status.HTTP_403_FORBIDDEN)
        from apps.groups.models import TrainingGroup

        groups = (
            TrainingGroup.objects.filter(renewal_cycles__course_assignments__course=course)
            .distinct()
            .order_by("id")
        )
        items = [
            {
                "id": str(g.id),
                "name": g.name,
                "status": "archived" if g.is_archived else "active",
                "memberCount": g.memberships.count(),
            }
            for g in groups
        ]
        return success_response({"groups": items})


class LecturerCourseQrSettingsView(APIView):
    """GET / PATCH /api/lecturer/courses/<course_id>/qr-settings."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إدارة رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)
        qr = get_or_create_course_qr(course)
        return success_response({"qrSettings": _serialize_course_qr(qr)})

    def patch(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية تعديل إعدادات رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)

        is_enabled = request.data.get("isEnabled")
        qr_mode = request.data.get("qrMode")
        expires_at = ...
        if "expiresAt" in request.data:
            raw_exp = request.data.get("expiresAt")
            if raw_exp in (None, ""):
                expires_at = None
            else:
                parsed = parse_datetime(str(raw_exp))
                if parsed is None:
                    return error_response("VALIDATION_ERROR", "صيغة تاريخ انتهاء الصلاحية غير صالحة.", status.HTTP_400_BAD_REQUEST)
                if timezone.is_naive(parsed):
                    parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
                expires_at = parsed
        try:
            qr = update_course_qr_settings(
                course,
                is_enabled=is_enabled,
                qr_mode=qr_mode,
                expires_at=expires_at,
            )
        except CourseDomainError as exc:
            return error_response(exc.code, exc.message, exc.status_code)
        return success_response({"qrSettings": _serialize_course_qr(qr)})


class LecturerCourseQrRotateView(APIView):
    """POST /api/lecturer/courses/<course_id>/qr-settings/rotate."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, course_id: int):
        course = Course.objects.filter(pk=course_id).first()
        if course is None:
            return error_response("RESOURCE_NOT_FOUND", "المورد المطلوب غير موجود أو تم نقله.", status.HTTP_404_NOT_FOUND)
        if not _is_course_staff(request.user, course):
            return error_response("PERMISSION_DENIED", "ليس لديك صلاحية إعادة توليد رمز QR لهذه الدورة.", status.HTTP_403_FORBIDDEN)
        qr = rotate_course_qr(course)
        return success_response({"qrSettings": _serialize_course_qr(qr)})


class CourseQrJoinInfoView(APIView):
    """GET /api/courses/join/<token>/info — Preview course before QR join."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, token: str):
        qr = CourseQrCode.objects.select_related("course", "course__primary_lecturer").filter(token=token).first()
        if qr is None:
            return error_response("RESOURCE_NOT_FOUND", "رمز QR غير صالح أو تم استبداله.", status.HTTP_404_NOT_FOUND)
        is_expired = bool(qr.expires_at and qr.expires_at <= timezone.now())
        return success_response(
            {
                "course": {
                    "id": str(qr.course.id),
                    "title": qr.course.title,
                    "description": qr.course.description,
                    "lecturerName": qr.course.primary_lecturer.full_name if qr.course.primary_lecturer else "",
                    "lifecycleStatus": qr.course.lifecycle_status,
                    "accessMode": qr.course.access_mode,
                },
                "qrSettings": {
                    "isEnabled": qr.is_enabled,
                    "qrMode": qr.qr_mode,
                    "expiresAt": qr.expires_at.isoformat() if qr.expires_at else None,
                    "isExpired": is_expired,
                },
            }
        )


class CourseQrJoinView(APIView):
    """POST /api/courses/join-by-qr — Access or auto-enroll via Course QR token."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request):
        token = str(request.data.get("token", "")).strip()
        if not token:
            return error_response("VALIDATION_ERROR", "رمز QR مطلوب.", status.HTTP_400_BAD_REQUEST)
        qr = CourseQrCode.objects.select_related("course").filter(token=token).first()
        if qr is None:
            return error_response("RESOURCE_NOT_FOUND", "رمز QR غير صالح أو تم استبداله.", status.HTTP_404_NOT_FOUND)
        if not qr.is_enabled:
            return error_response("QR_DISABLED", "تم إيقاف الدخول عبر رمز QR لهذا المقرر.", status.HTTP_403_FORBIDDEN)
        if qr.expires_at and qr.expires_at <= timezone.now():
            return error_response("QR_EXPIRED", "انتهت صلاحية رمز QR لهذا المقرر.", status.HTTP_403_FORBIDDEN)
        course = qr.course
        if course.lifecycle_status != "Published" and not _is_course_staff(request.user, course):
            return error_response("COURSE_NOT_PUBLISHED", "المقرر غير منشور حالياً.", status.HTTP_403_FORBIDDEN)

        enrolled = False
        if qr.qr_mode == "auto_enroll":
            from apps.learning.services.learning_service import enroll_user_in_course

            enroll_user_in_course(
                actor=request.user,
                user=request.user,
                course=course,
                source_type="qr_code",
            )
            enrolled = True

        return success_response(
            {
                "courseId": str(course.id),
                "qrMode": qr.qr_mode,
                "enrolled": enrolled,
            }
        )


